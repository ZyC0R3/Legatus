/**
 * Module: logging
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {Colors, EmbedBuilder, type Guild, type GuildTextBasedChannel, type Message} from "discord.js";
import {type GuildConfig} from "../config/schema.js";
import {formatDurationLabel} from "../moderation/types.js";
import {type ProfanityLevel} from "../config/schema.js";

// shouldLogViolation defines this module's public behavior or core flow.
function shouldLogViolation(level: GuildConfig["profanityLogging"]["level"]): boolean {
  return level === "violations" || level === "violations-and-moderations" || level === "all";
}

// shouldLogModeration defines this module's public behavior or core flow.
function shouldLogModeration(level: GuildConfig["profanityLogging"]["level"]): boolean {
  return level === "violations-and-moderations" || level === "all";
}

// resolveLogChannel defines this module's public behavior or core flow.
async function resolveLogChannel(guild: Guild, channelId: string | null): Promise<GuildTextBasedChannel | null> {
  if (!channelId) {
    return null;
  }

  const channel = guild.channels.cache.get(channelId)
    ?? await guild.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased() || channel.isDMBased()) {
    return null;
  }

  return channel;
}

type LogPayload = {
  embeds: EmbedBuilder[];
};

// sendLog defines this module's public behavior or core flow.
async function sendLog(guild: Guild, config: GuildConfig, payload: LogPayload): Promise<void> {
  const channel = await resolveLogChannel(guild, config.profanityLogging.channelId);
  if (!channel) {
    return;
  }

  await channel.send({embeds: payload.embeds}).catch(() => undefined);
}

// colorForSeverity defines this module's public behavior or core flow.
function colorForSeverity(severity: ProfanityLevel): number {
  if (severity === "critical") {
    return Colors.DarkRed;
  }

  if (severity === "high") {
    return Colors.Red;
  }

  if (severity === "medium") {
    return Colors.Orange;
  }

  return Colors.Yellow;
}

// colorForModerationAction defines this module's public behavior or core flow.
function colorForModerationAction(content: string): number {
  const normalized = content.toLowerCase();

  if (normalized.includes("banned")) {
    return Colors.DarkRed;
  }

  if (normalized.includes("kicked")) {
    return Colors.Orange;
  }

  if (normalized.includes("muted") || normalized.includes("unmuted")) {
    return normalized.includes("unmuted") ? Colors.Green : Colors.Blue;
  }

  if (normalized.includes("locked") || normalized.includes("closed") || normalized.includes("deleted")) {
    return Colors.Grey;
  }

  if (normalized.includes("opened")) {
    return Colors.Blurple;
  }

  return Colors.NotQuiteBlack;
}

// buildViolationEmbed defines this module's public behavior or core flow.
function buildViolationEmbed(message: Message, matchedWord: string, severity: ProfanityLevel, actionSummary: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(colorForSeverity(severity))
    .setTitle("Profanity Violation")
    .setDescription(`<@${message.author.id}> triggered a blocked word in <#${message.channelId}>.`)
    .addFields(
      {name: "Trigger", value: matchedWord || "Not set", inline: true},
      {name: "Severity", value: severity, inline: true},
      {name: "Action", value: actionSummary || "No actions configured", inline: false}
    )
    .setFooter({text: `Message ID: ${message.id}`})
    .setTimestamp();
}

// buildModerationActionEmbed defines this module's public behavior or core flow.
function buildModerationActionEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(colorForModerationAction(description))
    .setTitle("Moderation Action")
    .setDescription(description)
    .setTimestamp();
}

// buildAntiSpamActionEmbed defines this module's public behavior or core flow.
function buildAntiSpamActionEmbed(description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.Fuchsia)
    .setTitle("Anti-Spam Action")
    .setDescription(description)
    .setTimestamp();
}

// logViolationMessage defines this module's public behavior or core flow.
export async function logViolationMessage(
  message: Message,
  config: GuildConfig,
  matchedWord: string,
  severity: string,
  actionSummary: string
): Promise<void> {
  if (!message.guild || !shouldLogViolation(config.profanityLogging.level)) {
    return;
  }

  await sendLog(message.guild, config, {
    embeds: [buildViolationEmbed(message, matchedWord, severity as ProfanityLevel, actionSummary)]
  });
}

// logModerationAction defines this module's public behavior or core flow.
export async function logModerationAction(
  guild: Guild,
  config: GuildConfig,
  description: string
): Promise<void> {
  if (!shouldLogModeration(config.profanityLogging.level)) {
    return;
  }

  await sendLog(guild, config, {
    embeds: [buildModerationActionEmbed(description)]
  });
}

// logAntiSpamAction defines this module's public behavior or core flow.
export async function logAntiSpamAction(
  guild: Guild,
  config: GuildConfig,
  description: string
): Promise<void> {
  if (!config.antiSpamLogDeletedMessages) {
    return;
  }

  const channel = await resolveLogChannel(guild, config.antiSpamLoggingChannelId);
  if (!channel) {
    return;
  }

  await channel.send({embeds: [buildAntiSpamActionEmbed(description)]}).catch(() => undefined);
}
