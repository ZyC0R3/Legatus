import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  TextDisplayBuilder,
  TextChannel,
  type ButtonInteraction,
  type GuildMember,
  type Message,
  type MessageActionRowComponentBuilder,
  type ThreadChannel
} from "discord.js";
import type {GuildConfig} from "../config/schema.js";
import {logModerationAction} from "./logging.js";
import {
  buildCleanupEmbed,
  buildModerationControls,
  buildThreadEmbeds,
  buildModeratorPing,
  buildThreadActionPanel,
  createModerationTriggerSnapshot,
  cleanupRecentMessages,
  resolveTargetUserIdFromThreadName,
  startModerationThread,
  type ModerationTriggerSnapshot
} from "./moderation-thread.js";

const honeyPotButtonIds = {
  kick: "300307373a6e4c70e05794de924e2c9c",
  ban: "497d145355e4431d9b1ab44f80c999e3",
  removeMute: "521f16d7d8bb486aa4fa85e30ac2832c"
} as const;

const threadActionButtonIds = {
  lock: "300307373a6e4c70e05794de924e2c9d1",
  close: "497d145355e4431d9b1ab44f80c999e4",
  delete: "521f16d7d8bb486aa4fa85e30ac2832d"
} as const;

type PendingModerationPrompt = {
  promptMessageId: string;
  originalMessageId: string;
  expiresAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
  channelId: string;
};

const pendingModerationPrompts = new Map<string, PendingModerationPrompt>();

function canModerateTarget(actor: GuildMember, target: GuildMember): boolean {
  if (actor.id === target.id) {
    return false;
  }

  return actor.roles.highest.position > target.roles.highest.position;
}

function canUseModerationButtons(member: GuildMember, config: GuildConfig): boolean {
  const allowedRoleIds = new Set([...config.commandRoleIds, ...config.respondRoleIds]);

  if (allowedRoleIds.size === 0) {
    return false;
  }

  return member.roles.cache.some((role) => allowedRoleIds.has(role.id));
}

function canUseThreadActions(member: GuildMember, config: GuildConfig): boolean {
  return canUseModerationButtons(member, config);
}

function canUseModerationMentions(member: GuildMember, config: GuildConfig): boolean {
  if (config.moderationMentionRoleIds.length === 0) {
    return true;
  }

  return member.roles.cache.some((role) => config.moderationMentionRoleIds.includes(role.id));
}

function buildModerationPrompt(config: GuildConfig): string {
  return [
    "I need more information before I can continue.",
    "Add a ❌ reaction to the message that needs moderation action.",
    "Reply with the 19-digit message ID of the message you want moderated.",
  ].join("\n");
}

async function resolveReplyTargetMessage(message: Message): Promise<Message | null> {
  if (!message.reference) {
    return null;
  }

  return message.fetchReference().catch(() => null);
}

function getTargetUserIdFromMessage(message: Message): string {
  return message.author.id;
}

function extractMessageId(content: string): string | null {
  const match = content.match(/\b(\d{19})\b/);
  return match?.[1] ?? null;
}

export function registerModerationPrompt(promptMessageId: string, originalMessageId: string, channelId: string, timeoutMs = 60_000): void {
  const existingPrompt = pendingModerationPrompts.get(channelId);
  if (existingPrompt) {
    clearTimeout(existingPrompt.timeoutId);
  }

  const timeoutId = setTimeout(() => {
    pendingModerationPrompts.delete(channelId);
  }, timeoutMs);

  pendingModerationPrompts.set(channelId, {
    promptMessageId,
    originalMessageId,
    expiresAt: Date.now() + timeoutMs,
    timeoutId,
    channelId
  });
}

export function isPendingModerationPrompt(channelId: string): boolean {
  const prompt = pendingModerationPrompts.get(channelId);
  if (!prompt) {
    return false;
  }

  if (Date.now() > prompt.expiresAt) {
    clearTimeout(prompt.timeoutId);
    pendingModerationPrompts.delete(channelId);
    return false;
  }

  return true;
}

export function clearModerationPrompt(channelId: string): void {
  const prompt = pendingModerationPrompts.get(channelId);
  if (!prompt) {
    return;
  }

  clearTimeout(prompt.timeoutId);
  pendingModerationPrompts.delete(channelId);
}

export function getPendingModerationPrompt(channelId: string): PendingModerationPrompt | null {
  const prompt = pendingModerationPrompts.get(channelId);
  if (!prompt) {
    return null;
  }

  if (Date.now() > prompt.expiresAt) {
    clearModerationPrompt(channelId);
    return null;
  }

  return prompt;
}

export async function runModerationActionOnTargetMessage(targetMessage: Message, config: GuildConfig): Promise<ThreadChannel | null> {
  const trigger = createModerationTriggerSnapshot(targetMessage);
  if (!trigger) {
    return null;
  }

  const target = await trigger.guild.members.fetch(trigger.authorId).catch(() => null);
  if (!target || target.isCommunicationDisabled()) {
    return null;
  }

  await target.timeout(config.moderationTimeoutMs, "Moderation mention trigger").catch(() => undefined);

  await targetMessage.delete().catch(() => undefined);

  const thread = await startModerationThread(trigger, config, "Moderation Action", target);
  if (!thread) {
    await cleanupRecentMessages(trigger, config).catch(() => 0);
    return null;
  }

    const threadContent = [
      buildModeratorPing(config).trim(),
      `<@${target.id}>`,
      config.moderationThreadMessage.trim()
    ].filter((value) => value.length > 0).join(" \n");
    const threadEmbeds = await buildThreadEmbeds(
      trigger,
      target,
      "Moderation Action",
      ["Moderation action triggered from a replied-to message."],
      0x5865f2
    );

    try {
      await thread.members.add(target.id);
    } catch (error) {
      console.error(`Failed to add <@${target.id}> to moderation thread ${thread.id}.`, error);
    }

    try {
      await thread.send({content: threadContent, embeds: threadEmbeds});
    } catch (error) {
      console.error(`Failed to send rich moderation intro in thread ${thread.id}.`, error);
      await thread.send({content: `${threadContent}\nModeration action triggered from a replied-to message.`}).catch(() => undefined);
    }

    try {
      await thread.members.add(target.id);
    } catch (error) {
      console.error(`Retry to add <@${target.id}> to moderation thread ${thread.id} failed.`, error);
    }

  await thread.send({
    components: buildModerationControls(),
    flags: MessageFlags.IsComponentsV2
  }).catch(() => undefined);

  const deletedCount = await cleanupRecentMessages(trigger, config);
  if (deletedCount > 0) {
    await thread.send({embeds: [buildCleanupEmbed(trigger, deletedCount)]}).catch(() => undefined);
  }

  return thread;
}

export async function openModerationThreadForViolation(message: Message, config: GuildConfig, severity: string): Promise<ThreadChannel | null> {
  if (!message.inGuild()) {
    return null;
  }

  const trigger = createModerationTriggerSnapshot(message);
  if (!trigger) {
    return null;
  }

  const thread = await startModerationThread(trigger, config, "Profanity Action", null);
  if (!thread) {
    return null;
  }

  await thread.members.add(trigger.authorId).catch(() => undefined);
  await thread.send({
    content: [
      buildModeratorPing(config).trim(),
      `<@${trigger.authorId}>`,
      config.moderationThreadMessage.trim()
    ].filter((value) => value.length > 0).join(" \n"),
    embeds: await buildThreadEmbeds(
      trigger,
      await trigger.guild.members.fetch(trigger.authorId).catch(() => null),
      "Profanity Trigger",
      [
        `Automated profanity trigger from <@${trigger.authorId}> at severity ${severity}.`
      ],
      0xf97316
    )
  }).catch(() => undefined);

  await thread.send({
    components: buildModerationControls(),
    flags: MessageFlags.IsComponentsV2
  }).catch(() => undefined);

  return thread;
}

export async function handlePendingModerationPromptResponse(message: Message, config: GuildConfig): Promise<boolean> {
  if (!message.inGuild() || message.author.bot || !message.guild) {
    return false;
  }

  if (!isPendingModerationPrompt(message.channelId)) {
    return false;
  }

  const pendingPrompt = getPendingModerationPrompt(message.channelId);
  if (!pendingPrompt || message.id === pendingPrompt.promptMessageId) {
    return false;
  }

  const targetMessageId = extractMessageId(message.content);
  if (!targetMessageId) {
    return false;
  }

  const targetChannel = message.guild.channels.cache.get(pendingPrompt.channelId)
    ?? await message.guild.channels.fetch(pendingPrompt.channelId).catch(() => null);

  if (!targetChannel?.isTextBased() || targetChannel.isDMBased()) {
    clearModerationPrompt(message.channelId);
    return true;
  }

  const targetMessage = await targetChannel.messages.fetch(targetMessageId).catch(() => null);
  if (!targetMessage) {
    return false;
  }

  if (targetMessage.channelId !== pendingPrompt.channelId) {
    return false;
  }

  await runModerationActionOnTargetMessage(targetMessage, config).catch(() => undefined);
  const messageIdsToDelete = new Set<string>([
    message.id,
    pendingPrompt.originalMessageId,
    pendingPrompt.promptMessageId
  ]);

  for (const messageId of messageIdsToDelete) {
    if (messageId === targetMessage.id) {
      continue;
    }

    const channelMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
    if (channelMessage) {
      await channelMessage.delete().catch(() => undefined);
    }
  }

  clearModerationPrompt(message.channelId);

  return true;
}

async function applyThreadAction(interaction: ButtonInteraction, config: GuildConfig, action: "lock" | "close" | "delete"): Promise<boolean> {
  if (!interaction.inGuild()) {
    return false;
  }

  const guild = interaction.guild;
  if (!guild) {
    return false;
  }

  const actor = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!actor || !canUseThreadActions(actor, config)) {
    await interaction.deferUpdate().catch(() => undefined);
    return true;
  }

  const thread = interaction.channel;
  if (!thread || !thread.isThread()) {
    await interaction.reply({content: "This action can only be used inside a moderation thread.", flags: MessageFlags.Ephemeral});
    return true;
  }

  if (action === "lock") {
    await thread.setLocked(true, "Moderation thread locked").catch(() => undefined);
    await interaction.reply({content: "Thread locked.", flags: MessageFlags.Ephemeral}).catch(() => undefined);
    await logModerationAction(
      guild,
      config,
      `Locked moderation thread ${thread.name} (<#${thread.id}>) via button.`
    );
    return true;
  }

  if (action === "close") {
    await thread.setArchived(true, "Moderation thread closed").catch(() => undefined);
    await interaction.reply({content: "Thread closed.", flags: MessageFlags.Ephemeral}).catch(() => undefined);
    await logModerationAction(
      guild,
      config,
      `Closed moderation thread ${thread.name} (<#${thread.id}>) via button.`
    );
    return true;
  }

  await logModerationAction(
    guild,
    config,
    `Deleted moderation thread ${thread.name} (<#${thread.id}>) via button.`
  );
  await thread.delete("Moderation thread deleted").catch(() => undefined);
  return true;
}

export async function handleHoneyPotMessage(message: Message, config: GuildConfig): Promise<boolean> {
  if (!message.inGuild() || !message.member || message.author.bot) {
    return false;
  }

  if (!config.isHoneyPotChannel || !config.moderationChannelId) {
    return false;
  }

  if (message.channelId !== config.moderationChannelId) {
    return false;
  }

  const target = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!target || target.isCommunicationDisabled()) {
    return true;
  }

  const trigger = createModerationTriggerSnapshot(message);
  if (!trigger) {
    return true;
  }

  await target.timeout(config.moderationTimeoutMs, "Honey pot channel trigger").catch(() => undefined);
  await message.delete().catch(() => undefined);

  const thread = await startModerationThread(trigger, config, "Honey Pot", target);

  if (thread) {
    await thread.members.add(message.author.id).catch(() => undefined);

    await thread.send({
      content: [
        buildModeratorPing(config).trim(),
        `<@${message.author.id}>`,
        config.moderationThreadMessage.trim()
      ].filter((value) => value.length > 0).join(" \n"),
      embeds: await buildThreadEmbeds(trigger, target, "Honey Pot Trigger", ["User triggered the honey pot channel."], 0xf59e0b)
    }).catch(() => undefined);

    await thread.send({
      components: buildModerationControls(),
      flags: MessageFlags.IsComponentsV2
    }).catch(() => undefined);
  }

  const deletedCount = await cleanupRecentMessages(trigger, config);
  if (thread && deletedCount > 0) {
    await thread.send({embeds: [buildCleanupEmbed(trigger, deletedCount)]}).catch(() => undefined);
  }
  return true;
}

export async function handleModerationMention(message: Message, config: GuildConfig, botUserId: string | null): Promise<boolean> {
  if (!message.inGuild() || !message.member || message.author.bot || !botUserId) {
    return false;
  }

  if (!message.mentions.has(botUserId)) {
    return false;
  }

  const guild = message.guild;
  if (!guild) {
    return false;
  }

  const actor = message.member;
  if (!actor || !canUseModerationMentions(actor, config)) {
    return false;
  }

  if (message.reference) {
    const targetMessage = await resolveReplyTargetMessage(message);
    if (!targetMessage) {
      await message.reply({content: "I could not resolve the replied-to message."}).catch(() => undefined);
      return true;
    }

    if (targetMessage.author.bot) {
      await message.reply({content: "Reply to a user message, not a bot message."}).catch(() => undefined);
      return true;
    }

    const targetUserId = getTargetUserIdFromMessage(targetMessage);
    const target = await guild.members.fetch(targetUserId).catch(() => null);
    if (!target) {
      await message.reply({content: "Could not resolve the target user for the replied-to message."}).catch(() => undefined);
      return true;
    }

    const trigger = createModerationTriggerSnapshot(targetMessage);
    if (!trigger) {
      await message.reply({content: "Could not prepare moderation context for the replied-to message."}).catch(() => undefined);
      return true;
    }

    await target.timeout(config.moderationTimeoutMs, "Moderation mention reply").catch(() => undefined);

    await targetMessage.delete().catch(() => undefined);

    const thread = await startModerationThread(trigger, config, "Moderation Action", target);
    if (!thread) {
      await message.reply({content: "Could not open a moderation thread for the replied-to message."}).catch(() => undefined);
      return true;
    }

    await thread.members.add(targetUserId).catch(() => undefined);
    await thread.send({
      content: [
        buildModeratorPing(config).trim(),
        `<@${targetUserId}>`,
        config.moderationThreadMessage.trim()
      ].filter((value) => value.length > 0).join(" \n"),
      embeds: await buildThreadEmbeds(trigger, target, "Moderation Action", ["Moderation action triggered from a replied-to message."], 0x5865f2)
    }).catch(() => undefined);

    await thread.send({
      components: buildModerationControls(),
      flags: MessageFlags.IsComponentsV2
    }).catch(() => undefined);

    const deletedCount = await cleanupRecentMessages(trigger, config);
    if (deletedCount > 0) {
      await thread.send({embeds: [buildCleanupEmbed(trigger, deletedCount)]}).catch(() => undefined);
    }

    await message.delete().catch(() => undefined);

    return true;
  }

  const prompt = buildModerationPrompt(config);
  const promptMessage = await message.reply({content: prompt, allowedMentions: {parse: []}}).catch(() => null);

  if (promptMessage) {
    registerModerationPrompt(promptMessage.id, message.id, message.channelId);
  }

  return true;
}

export async function handleHoneyPotAction(interaction: ButtonInteraction, config: GuildConfig): Promise<boolean> {
  if (!interaction.inGuild()) {
    return false;
  }

  if (interaction.customId === threadActionButtonIds.lock) {
    return applyThreadAction(interaction, config, "lock");
  }

  if (interaction.customId === threadActionButtonIds.close) {
    return applyThreadAction(interaction, config, "close");
  }

  if (interaction.customId === threadActionButtonIds.delete) {
    return applyThreadAction(interaction, config, "delete");
  }

  const guild = interaction.guild;
  if (!guild) {
    return false;
  }

  if (
    interaction.customId !== honeyPotButtonIds.kick
    && interaction.customId !== honeyPotButtonIds.ban
    && interaction.customId !== honeyPotButtonIds.removeMute
  ) {
    return false;
  }

  const actor = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!actor || !canUseModerationButtons(actor, config)) {
    await interaction.deferUpdate().catch(() => undefined);
    return true;
  }

  const thread = interaction.channel;
  if (!thread || !thread.isThread()) {
    await interaction.reply({content: "This action can only be used inside a moderation thread.", flags: MessageFlags.Ephemeral});
    return true;
  }

  const threadStarter = await thread.fetchStarterMessage().catch(() => null);
  const targetUserId = threadStarter?.author.id ?? resolveTargetUserIdFromThreadName(thread.name);
  if (!targetUserId) {
    await interaction.reply({content: "Could not resolve the target user for this thread.", flags: MessageFlags.Ephemeral});
    return true;
  }

  const target = await guild.members.fetch(targetUserId).catch(() => null);

  if (!actor || !target) {
    await interaction.reply({content: "Could not resolve guild members for this action.", flags: MessageFlags.Ephemeral});
    return true;
  }

  if (!canModerateTarget(actor, target)) {
    await interaction.reply({content: "You cannot moderate this user due to role hierarchy.", flags: MessageFlags.Ephemeral});
    return true;
  }

  if (interaction.customId === honeyPotButtonIds.kick) {
    await target.kick("Honey pot moderation action").catch(() => undefined);
    await interaction.reply({content: `Kicked <@${target.id}>.`, flags: MessageFlags.Ephemeral});
    await thread.send({components: buildThreadActionPanel(target.id), flags: MessageFlags.IsComponentsV2}).catch(() => undefined);
    await logModerationAction(guild, config, `Kicked <@${target.id}> via moderation button.`);
    return true;
  }

  if (interaction.customId === honeyPotButtonIds.ban) {
    await guild.members.ban(target.id, {reason: "Honey pot moderation action"}).catch(() => undefined);
    await interaction.reply({content: `Banned <@${target.id}>.`, flags: MessageFlags.Ephemeral});
    await thread.send({components: buildThreadActionPanel(target.id), flags: MessageFlags.IsComponentsV2}).catch(() => undefined);
    await logModerationAction(guild, config, `Banned <@${target.id}> via moderation button.`);
    return true;
  }

  await target.timeout(null, "Honey pot moderation action: remove mute").catch(() => undefined);
  await interaction.reply({content: `Removed timeout for <@${target.id}>.`, flags: MessageFlags.Ephemeral});
  await thread.send({components: buildThreadActionPanel(target.id), flags: MessageFlags.IsComponentsV2}).catch(() => undefined);
  await logModerationAction(guild, config, `Unmuted <@${target.id}> via moderation button.`);
  return true;
}
