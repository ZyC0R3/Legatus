import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  TextBasedChannel,
  TextDisplayBuilder,
  TextChannel,
  ThreadAutoArchiveDuration,
  type GuildMember,
  type Message,
  type MessageActionRowComponentBuilder,
  type ThreadChannel
} from "discord.js";
import type {GuildConfig} from "../config/schema.js";

export type ModerationTriggerSnapshot = {
  guild: NonNullable<Message["guild"]>;
  authorId: string;
  authorUsername: string;
  channelId: string;
  channelName: string;
  content: string;
  createdTimestamp: number;
  messageId: string;
};

function getModeratorRoleIds(config: GuildConfig): string[] {
  const excludedRoleIds = new Set(config.moderationNoPingRoleIds);
  return [...new Set([...config.commandRoleIds, ...config.respondRoleIds])].filter((roleId) => !excludedRoleIds.has(roleId));
}

export function buildModeratorPing(config: GuildConfig): string {
  const moderatorRoleIds = getModeratorRoleIds(config);
  return moderatorRoleIds.length > 0
    ? moderatorRoleIds.map((roleId) => `<@&${roleId}>`).join(" ")
    : "";
}

export function createModerationTriggerSnapshot(message: Message): ModerationTriggerSnapshot | null {
  if (!message.guild) {
    return null;
  }

  const channel = message.guild.channels.cache.get(message.channelId);

  return {
    guild: message.guild,
    authorId: message.author.id,
    authorUsername: message.author.username,
    channelId: message.channelId,
    channelName: channel && "name" in channel ? channel.name : message.channelId,
    content: message.content,
    createdTimestamp: message.createdTimestamp,
    messageId: message.id
  };
}

function formatTimestampLabel(date: Date | null | undefined): string {
  if (!date) {
    return "Not available";
  }

  const seconds = Math.floor(date.getTime() / 1000);
  return `<t:${seconds}:F> (<t:${seconds}:R>)`;
}

function formatUserFlags(flags: readonly string[] | null | undefined): string {
  if (!flags || flags.length === 0) {
    return "None";
  }

  return flags.map((flag) => flag.replace(/([a-z])([A-Z])/g, "$1 $2")).join(", ");
}

function buildThreadActionEmbed(trigger: ModerationTriggerSnapshot, summaryTitle: string, summaryLines: string[], color: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(summaryTitle)
    .setDescription(summaryLines.join("\n"))
    .addFields(
      {name: "Original Channel", value: `<#${trigger.channelId}>`, inline: true},
      {name: "Original Message", value: trigger.messageId, inline: true},
      {name: "Captured Message", value: trigger.content.trim().length > 0 ? trigger.content : "[No text content]", inline: false}
    )
    .setTimestamp();
}

function buildUserDetailsEmbed(trigger: ModerationTriggerSnapshot, member: GuildMember | null): EmbedBuilder {
  const memberJoinDate = formatTimestampLabel(member?.joinedAt ?? null);
  const createdDate = member ? formatTimestampLabel(member.user.createdAt) : "Not available";
  const displayName = member?.displayName ?? trigger.authorUsername;
  const username = member?.user.username ?? trigger.authorUsername;
  const userFlags = formatUserFlags(member?.user.flags?.toArray() ?? []);
  const timeoutUntil = member?.communicationDisabledUntil ? formatTimestampLabel(member.communicationDisabledUntil) : "Not timed out";
  const roleMentions = member
    ? member.roles.cache
      .filter((role) => role.id !== member.guild.id)
      .map((role) => `<@&${role.id}>`)
      .slice(0, 15)
    : [];

  return new EmbedBuilder()
    .setColor(member?.displayColor || 0x5865f2)
    .setTitle("User Details")
    .setThumbnail(member?.displayAvatarURL({size: 256}) ?? null)
    .addFields(
      {name: "User", value: `<@${trigger.authorId}>`, inline: true},
      {name: "Username", value: username, inline: true},
      {name: "Display Name", value: displayName, inline: true},
      {name: "User ID", value: trigger.authorId, inline: false},
      {name: "Account Created", value: createdDate, inline: true},
      {name: "Joined Server", value: memberJoinDate, inline: true},
      {name: "Timeout Status", value: timeoutUntil, inline: true},
      {name: "Top Role", value: member ? `<@&${member.roles.highest.id}>` : "Not available", inline: true},
      {name: "Role Count", value: member ? String(Math.max(member.roles.cache.size - 1, 0)) : "Not available", inline: true},
      {name: "User Flags", value: userFlags, inline: false},
      {name: "Roles", value: roleMentions.length > 0 ? roleMentions.join(", ") : "None", inline: false}
    )
    .setFooter({text: `Captured from ${trigger.channelName}`})
    .setTimestamp();
}

export async function buildThreadEmbeds(
  trigger: ModerationTriggerSnapshot,
  member: GuildMember | null,
  title: string,
  summaryLines: string[],
  color: number
): Promise<EmbedBuilder[]> {
  return [
    buildThreadActionEmbed(trigger, title, summaryLines, color),
    buildUserDetailsEmbed(trigger, member)
  ];
}

export function buildCleanupEmbed(trigger: ModerationTriggerSnapshot, deletedCount: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x6b7280)
    .setTitle("Cleanup Results")
    .setDescription(`Deleted ${deletedCount} recent message${deletedCount === 1 ? "" : "s"} from <@${trigger.authorId}>.`)
    .addFields(
      {name: "Original Channel", value: `<#${trigger.channelId}>`, inline: true},
      {name: "Message ID", value: trigger.messageId, inline: true}
    )
    .setTimestamp();
}

export function buildModerationControls(): ContainerBuilder[] {
  return [
    new ContainerBuilder()
      .addActionRowComponents(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Kick User").setCustomId("300307373a6e4c70e05794de924e2c9c"),
          new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel("Ban User").setCustomId("497d145355e4431d9b1ab44f80c999e3"),
          new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Remove Mute").setCustomId("521f16d7d8bb486aa4fa85e30ac2832c")
        )
      )
  ];
}

function canTargetViewChannel(channel: TextChannel | null, target: GuildMember | null): boolean {
  if (!channel || !target) {
    return false;
  }

  const permissions = channel.permissionsFor(target);
  return Boolean(permissions?.has(PermissionFlagsBits.ViewChannel) && permissions?.has(PermissionFlagsBits.ReadMessageHistory));
}

async function resolveModerationThreadParent(
  trigger: ModerationTriggerSnapshot,
  config: GuildConfig,
  target: GuildMember | null
): Promise<TextChannel | null> {
  if (config.moderationChannelId) {
    const configuredChannel = trigger.guild.channels.cache.get(config.moderationChannelId)
      ?? await trigger.guild.channels.fetch(config.moderationChannelId).catch(() => null);

    if (configuredChannel?.type === ChannelType.GuildText) {
      if (!target || canTargetViewChannel(configuredChannel, target)) {
        return configuredChannel;
      }
    } else if (configuredChannel) {
      console.error(`Configured moderation channel ${config.moderationChannelId} is not a supported thread parent.`, {
        guildId: trigger.guild.id,
        channelId: configuredChannel.id,
        channelType: configuredChannel.type
      });
    }
  }

  const sourceChannel = trigger.guild.channels.cache.get(trigger.channelId)
    ?? await trigger.guild.channels.fetch(trigger.channelId).catch(() => null);

  if (sourceChannel?.type === ChannelType.GuildText) {
    return sourceChannel;
  }

  if (sourceChannel) {
    console.error(`Source channel ${trigger.channelId} is not a supported thread parent.`, {
      guildId: trigger.guild.id,
      channelId: sourceChannel.id,
      channelType: sourceChannel.type
    });
  }

  return null;
}

async function addModeratorsToThread(thread: ThreadChannel, config: GuildConfig, guild: Message["guild"]): Promise<void> {
  if (!guild) {
    return;
  }

  const moderatorRoleIds = getModeratorRoleIds(config);
  if (moderatorRoleIds.length === 0) {
    return;
  }

  for (const [memberId, member] of guild.members.cache) {
    if (member.user.bot) {
      continue;
    }

    const hasRole = member.roles.cache.some((role) => moderatorRoleIds.includes(role.id));
    if (!hasRole) {
      continue;
    }

    await thread.members.add(memberId).catch(() => undefined);
  }
}

export async function startModerationThread(
  trigger: ModerationTriggerSnapshot,
  config: GuildConfig,
  threadNamePrefix: string,
  target: GuildMember | null = null
): Promise<ThreadChannel | null> {
  const parentChannel = await resolveModerationThreadParent(trigger, config, target);
  if (!parentChannel) {
    console.error(`No valid thread parent channel could be resolved for ${threadNamePrefix}.`, {
      guildId: trigger.guild.id,
      configuredModerationChannelId: config.moderationChannelId,
      sourceChannelId: trigger.channelId,
      targetId: target?.id ?? null
    });
    return null;
  }

  const botMember = trigger.guild.members.me;
  if (!botMember) {
    console.error(`Cannot create moderation thread in ${parentChannel.id} because the bot member is unavailable.`, {
      guildId: trigger.guild.id,
      channelId: parentChannel.id,
      channelName: parentChannel.name,
      targetId: target?.id ?? null
    });
    return null;
  }

  const permissions = parentChannel.permissionsFor(botMember);
  if (!permissions?.has(PermissionFlagsBits.ViewChannel) || !permissions?.has(PermissionFlagsBits.SendMessages) || !permissions?.has(PermissionFlagsBits.CreatePrivateThreads)) {
    console.error(`Missing permissions to create a private thread in channel ${parentChannel.id}.`, {
      guildId: trigger.guild.id,
      channelId: parentChannel.id,
      channelName: parentChannel.name,
      requiredPermissions: [
        "ViewChannel",
        "SendMessages",
        "CreatePrivateThreads"
      ],
      missingPermissions: {
        viewChannel: permissions?.has(PermissionFlagsBits.ViewChannel) ?? false,
        sendMessages: permissions?.has(PermissionFlagsBits.SendMessages) ?? false,
        createPrivateThreads: permissions?.has(PermissionFlagsBits.CreatePrivateThreads) ?? false
      },
      targetId: target?.id ?? null
    });
    return null;
  }

  const thread = await parentChannel.threads.create({
    name: `${threadNamePrefix} - ${trigger.authorUsername} - ${trigger.authorId}`,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
    type: ChannelType.PrivateThread,
    invitable: false,
    reason: threadNamePrefix
  }).catch((error: unknown) => {
    console.error(`Failed to create moderation thread in channel ${parentChannel.id} for ${threadNamePrefix}.`, {
      guildId: trigger.guild.id,
      channelId: parentChannel.id,
      channelName: parentChannel.name,
      targetId: target?.id ?? null,
      error
    });
    return null;
  });

  if (!thread) {
    return null;
  }

  if (thread.type !== ChannelType.PrivateThread) {
    await thread.delete("Moderation thread creation did not return a private thread").catch(() => undefined);
    return null;
  }

  await addModeratorsToThread(thread, config, trigger.guild);
  return thread;
}

export async function cleanupRecentMessages(trigger: ModerationTriggerSnapshot, config: GuildConfig): Promise<number> {
  const guild = trigger.guild;
  const cutoff = trigger.createdTimestamp - config.messageDeletionWindowMs;
  const authorId = trigger.authorId;
  let deletedCount = 0;

  for (const [, channel] of guild.channels.cache) {
    if (!channel.isTextBased() || channel.isDMBased()) {
      continue;
    }

    const me = guild.members.me;
    if (!me) {
      continue;
    }

    if (!("permissionsFor" in channel)) {
      continue;
    }

    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms?.has(PermissionFlagsBits.ManageMessages)) {
      continue;
    }

    const textChannel = channel as TextBasedChannel;
    const messages = await textChannel.messages.fetch({limit: 100}).catch(() => null);
    if (!messages) {
      continue;
    }

    const toDelete = messages.filter((entry: Message) => {
      return entry.author.id === authorId
        && entry.createdTimestamp >= cutoff
        && entry.id !== trigger.messageId;
    });

    for (const [, entry] of toDelete) {
      await entry.delete().catch(() => undefined);
      deletedCount += 1;
    }
  }

  return deletedCount;
}

export function buildThreadActionPanel(targetUserId: string): ContainerBuilder[] {
  return [
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`Confirmation of moderation action for <@${targetUserId}>.`)
      )
      .addActionRowComponents(
        new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
          new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Lock Thread").setCustomId("300307373a6e4c70e05794de924e2c9d1"),
          new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel("Close Thread").setCustomId("497d145355e4431d9b1ab44f80c999e4"),
          new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel("Delete Thread").setCustomId("521f16d7d8bb486aa4fa85e30ac2832d")
        )
      )
  ];
}

export function resolveTargetUserIdFromThreadName(threadName: string): string | null {
  const match = threadName.match(/([0-9]{17,20})$/);
  return match?.[1] ?? null;
}
