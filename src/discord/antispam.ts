/**
 * Module: antispam
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, TextDisplayBuilder, TextInputStyle, type ButtonInteraction, type ChatInputCommandInteraction, type GuildTextBasedChannel, type Message, type ModalSubmitInteraction} from "discord.js";
import {ChannelSelectMenuBuilder, LabelBuilder, ModalBuilder, TextInputBuilder} from "@discordjs/builders";
import type {BotConfig, GuildConfig} from "../config/schema.js";
import {applyGuildSetupConfig, resolveGuildConfig, saveBotConfig} from "../config/store.js";
import {boundedLevenshtein} from "../moderation/bk-tree.js";
import {normalizeText} from "../moderation/normalize.js";
import {buildModeratorPing, buildModerationControls, buildThreadEmbeds, createModerationTriggerSnapshot, startModerationThread} from "./moderation-thread.js";
import {logAntiSpamAction} from "./logging.js";
import {buildDurationSelect} from "./setup/helpers.js";

const antiSpamPanelButtonIds = {
  setup: "legatus-antispam-setup",
  logging: "legatus-antispam-logging",
  cancel: "legatus-antispam-cancel"
} as const;

const antiSpamModalIds = {
  setup: "legatus-antispam-setup-modal",
  logging: "legatus-antispam-logging-modal"
} as const;

const antiSpamFieldIds = {
  bufferSeconds: "e69febd78a9b493ea52b7b608ff513e3",
  sameChannelRepeatThreshold: "bc35272c37c74771a71b36fbeb5d9e1c",
  uniqueChannels: "d4e5f6a7b8c94d1ea6f7f3b2c1d0e9f8",
  similarityPercent: "19bc07005f91476db050d4c89bf89e52",
  muteLength: "93bb6965b6214e398640a74ad46efffc",
  openThread: "ca0750cc6dcb45af9a43f937b2ff95a8",
  logDeletedMessages: "106094d590a24b34a41ee9c6b0b4385a",
  logChannel: "613f50142c6749599b89cb275c5c25cc"
} as const;

const antiSpamDefaultMuteOptions: Array<{label: string; durationMs: number}> = [
  {label: "60 Seconds", durationMs: 60 * 1000},
  {label: "5 Minutes", durationMs: 5 * 60 * 1000},
  {label: "1 Hour", durationMs: 60 * 60 * 1000},
  {label: "1 Day", durationMs: 24 * 60 * 60 * 1000},
  {label: "1 Week", durationMs: 7 * 24 * 60 * 60 * 1000}
];

type AntiSpamEntry = {
  messageId: string;
  channelId: string;
  createdTimestamp: number;
  signature: string;
};

const antiSpamBuffers = new Map<string, AntiSpamEntry[]>();
const antiSpamCooldowns = new Map<string, number>();
const antiSpamCooldownMs = 30 * 1000;
const antiSpamCleanupGraceMs = 2_000;

// antiSpamKey defines this module's public behavior or core flow.
function antiSpamKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

// clampInt defines this module's public behavior or core flow.
function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  const rounded = Math.round(value);
  return Math.min(max, Math.max(min, rounded));
}

// buildAntiSpamPanel defines this module's public behavior or core flow.
function buildAntiSpamPanel(): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Anti-Spam Configuration",
          "Use Setup to configure the detection thresholds, or Logging to configure the mute length and moderation output."
        ].join("\n")
      )
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(antiSpamPanelButtonIds.setup).setLabel("Set up").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(antiSpamPanelButtonIds.logging).setLabel("Logging").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(antiSpamPanelButtonIds.cancel).setLabel("Cancel").setStyle(ButtonStyle.Danger)
      )
    );
}

// buildAntiSpamSetupModal defines this module's public behavior or core flow.
function buildAntiSpamSetupModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setTitle("Anti-Spam - Setup")
    .setCustomId(antiSpamModalIds.setup)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Buffer length")
        .setDescription("How long to keep message history in memory, in seconds.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(antiSpamFieldIds.bufferSeconds)
            .setStyle(TextInputStyle.Short)
            .setValue(String(config.antiSpamBufferSeconds))
            .setRequired(true)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Message limit")
        .setDescription("Number of messages sent within the time frame to trigger anti-spam.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(antiSpamFieldIds.sameChannelRepeatThreshold)
            .setStyle(TextInputStyle.Short)
            .setValue(String(config.antiSpamSameChannelRepeatThreshold))
            .setRequired(true)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Unique channels")
        .setDescription("How many different channels messages can be sent in within the time frame.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(antiSpamFieldIds.uniqueChannels)
            .setStyle(TextInputStyle.Short)
            .setValue(String(config.antiSpamUniqueChannelsThreshold))
            .setRequired(true)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Normalized match similarity")
        .setDescription("How similar messages must be to match. Example: 95% requires 95% similarity.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(antiSpamFieldIds.similarityPercent)
            .setStyle(TextInputStyle.Short)
            .setValue(String(config.antiSpamSimilarityPercent))
            .setRequired(true)
        )
    );
}

// buildAntiSpamLoggingModal defines this module's public behavior or core flow.
function buildAntiSpamLoggingModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setTitle("Anti-Spam - Logging")
    .setCustomId(antiSpamModalIds.logging)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Mute length")
        .setDescription("Choose how long the anti-spam mute should last.")
        .setStringSelectMenuComponent(
          buildDurationSelect(antiSpamFieldIds.muteLength, config.antiSpamMuteLengthMs, [
            {label: "60 Seconds", value: 60 * 1000},
            {label: "5 Minutes", value: 5 * 60 * 1000},
            {label: "1 Hour", value: 60 * 60 * 1000},
            {label: "1 Day", value: 24 * 60 * 60 * 1000},
            {label: "1 Week", value: 7 * 24 * 60 * 60 * 1000}
          ])
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Open moderation thread")
        .setDescription("Type yes or no.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(antiSpamFieldIds.openThread)
            .setStyle(TextInputStyle.Short)
            .setValue(config.antiSpamOpenModerationThread ? "yes" : "no")
            .setRequired(true)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Log deleted messages")
        .setDescription("If enabled, anti-spam actions will be logged to the selected channel.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(antiSpamFieldIds.logDeletedMessages)
            .setStyle(TextInputStyle.Short)
            .setValue(config.antiSpamLogDeletedMessages ? "yes" : "no")
            .setRequired(true)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Log channel")
        .setDescription("Select a channel to use for anti-spam logging. Leave blank to disable anti-spam logging.")
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId(antiSpamFieldIds.logChannel)
            .setRequired(false)
            .setChannelTypes([0])
        )
    );
}

// showAntiSpamPanel defines this module's public behavior or core flow.
export async function showAntiSpamPanel(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Anti-spam can only be configured inside a server.",
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.reply({
    components: [buildAntiSpamPanel()],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
  });
}

// parseYesNoSelection defines this module's public behavior or core flow.
function parseYesNoSelection(value: string | undefined, falseValue: string): boolean {
  return typeof value === "string" && value.trim().toLowerCase() !== falseValue;
}

// handleAntiSpamButton defines this module's public behavior or core flow.
export async function handleAntiSpamButton(interaction: ButtonInteraction, botConfig: BotConfig): Promise<boolean> {
  if (
    interaction.customId !== antiSpamPanelButtonIds.setup
    && interaction.customId !== antiSpamPanelButtonIds.logging
    && interaction.customId !== antiSpamPanelButtonIds.cancel
  ) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Anti-spam can only be configured inside a server.",
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const config = resolveGuildConfig(botConfig, interaction.guildId);

  if (interaction.customId === antiSpamPanelButtonIds.cancel) {
    await interaction.deferUpdate();
    await interaction.deleteReply().catch(() => undefined);
    return true;
  }

  if (interaction.customId === antiSpamPanelButtonIds.setup) {
    await interaction.showModal(buildAntiSpamSetupModal(config));
    return true;
  }

  await interaction.showModal(buildAntiSpamLoggingModal(config));
  return true;
}

// selectedChannelId defines this module's public behavior or core flow.
function selectedChannelId(values: {values(): Iterable<{id: string} | null>} | null): string | null {
  return Array.from(values?.values() ?? [], (channel) => channel?.id).find((channelId): channelId is string => typeof channelId === "string") ?? null;
}

// handleAntiSpamModal defines this module's public behavior or core flow.
export async function handleAntiSpamModal(interaction: ModalSubmitInteraction, botConfig: BotConfig): Promise<boolean> {
  if (interaction.customId !== antiSpamModalIds.setup && interaction.customId !== antiSpamModalIds.logging) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "Anti-spam can only be configured inside a server.",
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  const currentConfig = resolveGuildConfig(botConfig, interaction.guildId);
  const patch = interaction.customId === antiSpamModalIds.setup
    ? {
        antiSpamBufferSeconds: clampInt(Number(interaction.fields.getTextInputValue(antiSpamFieldIds.bufferSeconds)), 1, 60),
        antiSpamSameChannelRepeatThreshold: clampInt(Number(interaction.fields.getTextInputValue(antiSpamFieldIds.sameChannelRepeatThreshold)), 2, 25),
        antiSpamUniqueChannelsThreshold: clampInt(Number(interaction.fields.getTextInputValue(antiSpamFieldIds.uniqueChannels)), 2, 25),
        antiSpamSimilarityPercent: clampInt(Number(interaction.fields.getTextInputValue(antiSpamFieldIds.similarityPercent)), 50, 100)
      }
    : {
        antiSpamMuteLengthMs: Number(interaction.fields.getStringSelectValues(antiSpamFieldIds.muteLength)[0] ?? String(currentConfig.antiSpamMuteLengthMs)),
        antiSpamOpenModerationThread: parseYesNoSelection(interaction.fields.getTextInputValue(antiSpamFieldIds.openThread), "no"),
        antiSpamLogDeletedMessages: parseYesNoSelection(interaction.fields.getStringSelectValues(antiSpamFieldIds.logDeletedMessages)[0], "no"),
        antiSpamLoggingChannelId: selectedChannelId(interaction.fields.getSelectedChannels(antiSpamFieldIds.logChannel, false))
      };

  applyGuildSetupConfig(botConfig, interaction.guildId, patch);
  await saveBotConfig(botConfig);

  await interaction.reply({
    content: "Anti-spam configuration saved.",
    flags: MessageFlags.Ephemeral
  });
  return true;
}

// buildMessageSignature defines this module's public behavior or core flow.
function buildMessageSignature(message: Message): string {
  const normalizedText = normalizeText(message.content).normalized;
  if (normalizedText.length > 0) {
    return `text:${normalizedText}`;
  }

  if (message.attachments.size > 0) {
    const attachmentSignature = [...message.attachments.values()]
      .map((attachment) => `${attachment.contentType ?? "unknown"}:${attachment.name ?? "unknown"}:${attachment.size}`)
      .sort()
      .join("|");

    if (attachmentSignature.length > 0) {
      return `attachment:${attachmentSignature}`;
    }
  }

  return "";
}

// similarityPercent defines this module's public behavior or core flow.
function similarityPercent(left: string, right: string): number {
  if (left === right) {
    return 100;
  }

  if (left.startsWith("attachment:") || right.startsWith("attachment:")) {
    return 0;
  }

  const leftText = left.startsWith("text:") ? left.slice(5) : left;
  const rightText = right.startsWith("text:") ? right.slice(5) : right;

  const maxLen = Math.max(leftText.length, rightText.length);
  if (maxLen === 0) {
    return 0;
  }

  const distance = boundedLevenshtein(leftText, rightText, maxLen);
  const similarity = (1 - (distance / maxLen)) * 100;
  return Math.max(0, Math.min(100, similarity));
}

// resolveTextChannel defines this module's public behavior or core flow.
async function resolveTextChannel(message: Message, channelId: string): Promise<GuildTextBasedChannel | null> {
  if (!message.guild) {
    return null;
  }

  const channel = message.guild.channels.cache.get(channelId)
    ?? await message.guild.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    return null;
  }

  return channel;
}

// openAntiSpamModerationThread defines this module's public behavior or core flow.
async function openAntiSpamModerationThread(
  message: Message,
  config: GuildConfig,
  matchedChannelCount: number,
  matchedMessageCount: number,
  triggerReason: string
): Promise<void> {
  if (!message.guild || !message.member) {
    return;
  }

  const trigger = createModerationTriggerSnapshot(message);
  if (!trigger) {
    return;
  }

  const thread = await startModerationThread(trigger, config, "Anti Spam", null);
  if (!thread) {
    return;
  }

  const threadContent = [
    buildModeratorPing(config).trim(),
    `<@${trigger.authorId}>`,
    config.moderationThreadMessage.trim()
  ].filter((value) => value.length > 0).join(" \n");

  const threadEmbeds = await buildThreadEmbeds(
    trigger,
    message.member,
    "Anti-Spam Trigger",
    [
      `Detected anti-spam trigger (${triggerReason}) from <@${trigger.authorId}>.`,
      `Matched ${matchedMessageCount} messages across ${matchedChannelCount} channels within ${config.antiSpamBufferSeconds} seconds.`,
      `Similarity threshold: ${config.antiSpamSimilarityPercent}%`
    ],
    0xe11d48
  );

  await thread.send({content: threadContent, embeds: threadEmbeds}).catch(() => undefined);
  await thread.send({
    components: buildModerationControls(),
    flags: MessageFlags.IsComponentsV2
  }).catch(() => undefined);
}

// handleAntiSpamMessage defines this module's public behavior or core flow.
export async function handleAntiSpamMessage(message: Message, config: GuildConfig): Promise<boolean> {
  if (!message.inGuild() || !message.member || !config.antiSpamEnabled) {
    return false;
  }

  const signature = buildMessageSignature(message);
  if (!signature) {
    return false;
  }

  const key = antiSpamKey(message.guildId, message.author.id);
  const now = message.createdTimestamp;
  const bufferMs = clampInt(config.antiSpamBufferSeconds, 1, 60) * 1000;
  const thresholdPercent = clampInt(config.antiSpamSimilarityPercent, 50, 100);
  const channelThreshold = clampInt(config.antiSpamUniqueChannelsThreshold, 2, 25);
  const sameChannelThreshold = clampInt(config.antiSpamSameChannelRepeatThreshold, 2, 25);

  const recentEntries = (antiSpamBuffers.get(key) ?? []).filter((entry) => now - entry.createdTimestamp <= bufferMs);

  const currentEntry: AntiSpamEntry = {
    messageId: message.id,
    channelId: message.channelId,
    createdTimestamp: now,
    signature
  };

  recentEntries.push(currentEntry);
  antiSpamBuffers.set(key, recentEntries);

  const cooldownUntil = antiSpamCooldowns.get(key) ?? 0;
  if (cooldownUntil > now) {
    return false;
  }

  const matchedEntries = recentEntries.filter((entry) => similarityPercent(signature, entry.signature) >= thresholdPercent);
  const matchedChannelIds = new Set(matchedEntries.map((entry) => entry.channelId));
  const matchedInCurrentChannel = matchedEntries.filter((entry) => entry.channelId === message.channelId).length;

  const crossChannelTriggered = matchedChannelIds.size >= channelThreshold;
  const sameChannelTriggered = matchedInCurrentChannel >= sameChannelThreshold;

  if (!crossChannelTriggered && !sameChannelTriggered) {
    return false;
  }

  const triggerReason = crossChannelTriggered
    ? `cross-channel threshold (${matchedChannelIds.size}/${channelThreshold})`
    : `same-channel repeat threshold (${matchedInCurrentChannel}/${sameChannelThreshold})`;

  const cleanupWindowMs = bufferMs + antiSpamCleanupGraceMs;
  const cleanupEntries = (antiSpamBuffers.get(key) ?? [])
    .filter((entry) => now - entry.createdTimestamp <= cleanupWindowMs)
    .filter((entry) => similarityPercent(signature, entry.signature) >= thresholdPercent)
    .sort((left, right) => left.createdTimestamp - right.createdTimestamp);

  antiSpamCooldowns.set(key, now + antiSpamCooldownMs);

  let deletedCount = 0;
  for (const entry of cleanupEntries) {
    if (entry.messageId === message.id) {
      const deletedCurrent = await message.delete().then(() => true).catch(() => false);
      if (deletedCurrent) {
        deletedCount += 1;
      }
      continue;
    }

    const channel = await resolveTextChannel(message, entry.channelId);
    if (!channel) {
      continue;
    }

    const targetMessage = await channel.messages.fetch(entry.messageId).catch(() => null);
    if (!targetMessage) {
      continue;
    }

    const deleted = await targetMessage.delete().then(() => true).catch(() => false);
    if (deleted) {
      deletedCount += 1;
    }
  }

  const timedOut = await message.member.timeout(config.antiSpamMuteLengthMs, "Anti-spam burst detection").then(() => true).catch(() => false);

  if (config.antiSpamOpenModerationThread) {
    await openAntiSpamModerationThread(message, config, matchedChannelIds.size, cleanupEntries.length, triggerReason);
  }

  const summary = [
    `Anti-spam triggered for <@${message.author.id}> in <#${message.channelId}>.`,
    `Trigger reason: ${triggerReason}.`,
    `Matched ${matchedEntries.length} messages across ${matchedChannelIds.size} channels in ${config.antiSpamBufferSeconds} seconds at ${config.antiSpamSimilarityPercent}% similarity.`,
    `Deleted ${deletedCount} message${deletedCount === 1 ? "" : "s"}${timedOut ? ", applied timeout." : ", timeout failed."}`
  ].join(" ");

  await logAntiSpamAction(message.guild, config, summary);

  return true;
}
