/**
 * Module: access-control
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {Colors, EmbedBuilder, type Guild, type GuildMember, type GuildTextBasedChannel, type Message, type MessageReaction, type PartialMessageReaction, type PartialGuildMember} from "discord.js";
import type {GuildConfig} from "../config/schema.js";

// normalizeValue defines this module's public behavior or core flow.
function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

// emojiMatches defines this module's public behavior or core flow.
function emojiMatches(configuredEmoji: string, reaction: MessageReaction | PartialMessageReaction): boolean {
  const normalizedConfigured = configuredEmoji.trim();
  if (!normalizedConfigured) {
    return false;
  }

  const emojiId = reaction.emoji.id;
  const emojiName = reaction.emoji.name;
  const emojiString = reaction.emoji.toString();

  if (normalizedConfigured === emojiString) {
    return true;
  }

  if (emojiId) {
    if (normalizedConfigured === emojiId) {
      return true;
    }

    if (normalizedConfigured.endsWith(`:${emojiId}>`)) {
      return true;
    }
  }

  if (emojiName && normalizedConfigured === emojiName) {
    return true;
  }

  return false;
}

// applyRole defines this module's public behavior or core flow.
async function applyRole(member: GuildMember, roleId: string): Promise<boolean> {
  if (member.roles.cache.has(roleId)) {
    return false;
  }

  const applied = await member.roles.add(roleId, "Legatus access control trigger").then(() => true).catch(() => false);
  return applied;
}

// removeRole defines this module's public behavior or core flow.
async function removeRole(member: GuildMember, roleId: string | null): Promise<void> {
  if (!roleId || !member.roles.cache.has(roleId)) {
    return;
  }

  await member.roles.remove(roleId, "Legatus access control trigger").catch(() => undefined);
}

// resolveWelcomeChannel defines this module's public behavior or core flow.
async function resolveWelcomeChannel(guild: Guild, config: GuildConfig, fallbackChannel: GuildTextBasedChannel): Promise<GuildTextBasedChannel> {
  if (!config.accessWelcomeMessageChannelId) {
    return fallbackChannel;
  }

  const configuredChannel = guild.channels.cache.get(config.accessWelcomeMessageChannelId)
    ?? await guild.channels.fetch(config.accessWelcomeMessageChannelId).catch(() => null);

  if (!configuredChannel || !configuredChannel.isTextBased() || configuredChannel.isDMBased()) {
    return fallbackChannel;
  }

  return configuredChannel;
}

// sendWelcomeMessage defines this module's public behavior or core flow.
async function sendWelcomeMessage(member: GuildMember, config: GuildConfig, fallbackChannel: GuildTextBasedChannel): Promise<void> {
  const messageTemplate = config.accessWelcomeMessage.trim();
  if (!messageTemplate) {
    return;
  }

  const channel = await resolveWelcomeChannel(member.guild, config, fallbackChannel);
  const content = messageTemplate.includes("{user}")
    ? messageTemplate.replaceAll("{user}", `<@${member.id}>`)
    : `${messageTemplate}\n<@${member.id}>`;

  await channel.send({content}).catch(() => undefined);
}

// applyAccessRoles defines this module's public behavior or core flow.
async function applyAccessRoles(member: GuildMember, addRoleId: string, removeRoleId: string | null): Promise<boolean> {
  const wasAdded = await applyRole(member, addRoleId);
  await removeRole(member, removeRoleId);
  return wasAdded;
}

// resolveJoinLeaveLogChannel defines this module's public behavior or core flow.
async function resolveJoinLeaveLogChannel(guild: Guild, config: GuildConfig): Promise<GuildTextBasedChannel | null> {
  if (!config.accessJoinLeaveLoggingChannelId) {
    return null;
  }

  const channel = guild.channels.cache.get(config.accessJoinLeaveLoggingChannelId)
    ?? await guild.channels.fetch(config.accessJoinLeaveLoggingChannelId).catch(() => null);

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    return null;
  }

  return channel;
}

// shouldLogJoinLeave defines this module's public behavior or core flow.
function shouldLogJoinLeave(config: GuildConfig, type: "join" | "leave"): boolean {
  if (!config.accessJoinLeaveLoggingChannelId) {
    return false;
  }

  if (config.accessJoinLeaveLogging === "both") {
    return true;
  }

  return config.accessJoinLeaveLogging === type;
}

// logJoinLeave defines this module's public behavior or core flow.
async function logJoinLeave(guild: Guild, config: GuildConfig, memberId: string, username: string, type: "join" | "leave"): Promise<void> {
  if (!shouldLogJoinLeave(config, type)) {
    return;
  }

  const channel = await resolveJoinLeaveLogChannel(guild, config);
  if (!channel) {
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(type === "join" ? Colors.Green : Colors.Red)
    .setTitle(type === "join" ? "Member Joined" : "Member Left")
    .setDescription(`<@${memberId}> ${type === "join" ? "joined" : "left"} the server.`)
    .addFields(
      {name: "User", value: `<@${memberId}>`, inline: true},
      {name: "Username", value: username, inline: true},
      {name: "User ID", value: memberId, inline: false}
    )
    .setTimestamp();

  await channel.send({embeds: [embed]}).catch(() => undefined);
}

// handleAccessPasswordMessage defines this module's public behavior or core flow.
export async function handleAccessPasswordMessage(message: Message, config: GuildConfig): Promise<boolean> {
  if (!message.inGuild() || !message.member || message.author.bot) {
    return false;
  }

  const accessPhrase = normalizeValue(config.accessPasswordPhrase);
  const accessRoleId = config.accessPasswordRoleId;
  if (!accessPhrase || !accessRoleId) {
    return false;
  }

  if (config.accessPasswordChannelId && message.channelId !== config.accessPasswordChannelId) {
    return false;
  }

  if (normalizeValue(message.content) !== accessPhrase) {
    return false;
  }

  const roleAdded = await applyAccessRoles(message.member, accessRoleId, config.accessPasswordRemoveRoleId);
  if (roleAdded && message.channel.isTextBased() && !message.channel.isDMBased()) {
    await sendWelcomeMessage(message.member, config, message.channel);
  }
  await message.delete().catch(() => undefined);
  return true;
}

// handleAccessEmojiReaction defines this module's public behavior or core flow.
export async function handleAccessEmojiReaction(
  reaction: MessageReaction | PartialMessageReaction,
  user: {id: string; bot: boolean},
  config: GuildConfig
): Promise<boolean> {
  if (user.bot) {
    return false;
  }

  const fullReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
  if (!fullReaction) {
    return false;
  }

  const message = fullReaction.message;
  if (!message.inGuild()) {
    return false;
  }

  const accessRoleId = config.accessEmojiRoleId;
  const removeRoleId = config.accessEmojiRemoveRoleId;
  const accessEmoji = config.accessEmojiValue;
  const accessChannelId = config.accessEmojiChannelId;
  if (!accessRoleId || !accessEmoji || !accessChannelId) {
    return false;
  }

  if (message.channelId !== accessChannelId) {
    return false;
  }

  if (config.accessEmojiMessageId && message.id !== config.accessEmojiMessageId) {
    return false;
  }

  if (!emojiMatches(accessEmoji, fullReaction)) {
    return false;
  }

  const member = await message.guild.members.fetch(user.id).catch(() => null);
  if (member && message.channel.isTextBased() && !message.channel.isDMBased()) {
    const roleAdded = await applyAccessRoles(member, accessRoleId, removeRoleId);
    if (roleAdded) {
      await sendWelcomeMessage(member, config, message.channel);
    }
  }

  await fullReaction.users.remove(user.id).catch(() => undefined);
  return true;
}

// handleAccessMemberJoin defines this module's public behavior or core flow.
export async function handleAccessMemberJoin(member: GuildMember, config: GuildConfig): Promise<void> {
  // Join-role assignment is independent of access control triggers.
  if (config.joinRoleId && !member.roles.cache.has(config.joinRoleId)) {
    await member.roles.add(config.joinRoleId, "Legatus join role assignment").catch(() => undefined);
  }

  await logJoinLeave(member.guild, config, member.id, member.user.username, "join");
}

// handleAccessMemberLeave defines this module's public behavior or core flow.
export async function handleAccessMemberLeave(member: GuildMember | PartialGuildMember, config: GuildConfig): Promise<void> {
  const username = member.user?.username ?? "Unknown User";
  await logJoinLeave(member.guild, config, member.id, username, "leave");
}
