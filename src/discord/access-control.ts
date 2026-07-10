/**
 * Module: access-control
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {type GuildMember, type Message, type MessageReaction, type PartialMessageReaction} from "discord.js";
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
async function applyRole(member: GuildMember, roleId: string): Promise<void> {
  if (member.roles.cache.has(roleId)) {
    return;
  }

  await member.roles.add(roleId, "Legatus access control trigger").catch(() => undefined);
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

  await applyRole(message.member, accessRoleId);
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
  if (member) {
    await applyRole(member, accessRoleId);
  }

  await fullReaction.users.remove(user.id).catch(() => undefined);
  return true;
}
