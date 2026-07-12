/**
 * Module: store
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {dirname, join} from "node:path";
import {botConfigSchema, defaultBotConfig, type BotConfig, type GuildConfig} from "./schema.js";

const configFilePath = join(process.cwd(), "data", "config.json");

// mergeLists defines this module's public behavior or core flow.
function mergeLists(...lists: Array<readonly string[]>): string[] {
  return [...new Set(lists.flat().filter(Boolean))];
}

// resolveGuildConfig defines this module's public behavior or core flow.
export function resolveGuildConfig(config: BotConfig, guildId: string): GuildConfig {
  const guildConfig = config.guilds[guildId];

  if (!guildConfig) {
    return {
      ...config.global
    };
  }

  return {
    commandRoleIds: mergeLists(config.global.commandRoleIds, guildConfig.commandRoleIds),
    respondRoleIds: mergeLists(config.global.respondRoleIds, guildConfig.respondRoleIds),
    moderationMentionRoleIds: mergeLists(config.global.moderationMentionRoleIds, guildConfig.moderationMentionRoleIds),
    joinRoleId: guildConfig.joinRoleId ?? config.global.joinRoleId,
    moderationNoPingRoleIds: mergeLists(config.global.moderationNoPingRoleIds, guildConfig.moderationNoPingRoleIds),
    ignoredRoleIds: mergeLists(config.global.ignoredRoleIds, guildConfig.ignoredRoleIds),
    ignoredUserIds: mergeLists(config.global.ignoredUserIds, guildConfig.ignoredUserIds),
    accessPasswordPhrase: guildConfig.accessPasswordPhrase ?? config.global.accessPasswordPhrase,
    accessPasswordRoleId: guildConfig.accessPasswordRoleId ?? config.global.accessPasswordRoleId,
    accessPasswordRemoveRoleId: guildConfig.accessPasswordRemoveRoleId ?? config.global.accessPasswordRemoveRoleId,
    accessPasswordChannelId: guildConfig.accessPasswordChannelId ?? config.global.accessPasswordChannelId,
    accessEmojiValue: guildConfig.accessEmojiValue ?? config.global.accessEmojiValue,
    accessEmojiRoleId: guildConfig.accessEmojiRoleId ?? config.global.accessEmojiRoleId,
    accessEmojiRemoveRoleId: guildConfig.accessEmojiRemoveRoleId ?? config.global.accessEmojiRemoveRoleId,
    accessEmojiChannelId: guildConfig.accessEmojiChannelId ?? config.global.accessEmojiChannelId,
    accessEmojiMessageId: guildConfig.accessEmojiMessageId ?? config.global.accessEmojiMessageId,
    accessEmojiMessageContent: guildConfig.accessEmojiMessageContent ?? config.global.accessEmojiMessageContent,
    accessWelcomeMessage: guildConfig.accessWelcomeMessage ?? config.global.accessWelcomeMessage,
    accessWelcomeMessageChannelId: guildConfig.accessWelcomeMessageChannelId ?? config.global.accessWelcomeMessageChannelId,
    accessJoinLeaveLogging: guildConfig.accessJoinLeaveLogging ?? config.global.accessJoinLeaveLogging,
    accessJoinLeaveLoggingChannelId: guildConfig.accessJoinLeaveLoggingChannelId ?? config.global.accessJoinLeaveLoggingChannelId,
    profanityLowTerms: guildConfig.profanityLowTerms ?? config.global.profanityLowTerms,
    profanityMediumTerms: guildConfig.profanityMediumTerms ?? config.global.profanityMediumTerms,
    profanityHighTerms: guildConfig.profanityHighTerms ?? config.global.profanityHighTerms,
    profanityCriticalTerms: guildConfig.profanityCriticalTerms ?? config.global.profanityCriticalTerms,
    profanityTermsConfigured: guildConfig.profanityTermsConfigured ?? config.global.profanityTermsConfigured,
    profanityActiveLevels: guildConfig.profanityActiveLevels ?? config.global.profanityActiveLevels,
    profanityRules: guildConfig.profanityRules ?? config.global.profanityRules,
    profanityCleanup: guildConfig.profanityCleanup ?? config.global.profanityCleanup,
    profanityLogging: guildConfig.profanityLogging ?? config.global.profanityLogging,
    messageTriggers: mergeLists(config.global.messageTriggers, guildConfig.messageTriggers),
    mentionRepliesEnabled: guildConfig.mentionRepliesEnabled ?? config.global.mentionRepliesEnabled,
    moderationChannelId: guildConfig.moderationChannelId ?? config.global.moderationChannelId,
    moderationCategoryId: guildConfig.moderationCategoryId ?? config.global.moderationCategoryId,
    moderationChannelMode: guildConfig.moderationChannelMode ?? config.global.moderationChannelMode,
    isHoneyPotChannel: guildConfig.isHoneyPotChannel ?? config.global.isHoneyPotChannel,
    moderationTimeoutMs: guildConfig.moderationTimeoutMs ?? config.global.moderationTimeoutMs,
    messageDeletionWindowMs: guildConfig.messageDeletionWindowMs ?? config.global.messageDeletionWindowMs,
    antiSpamEnabled: guildConfig.antiSpamEnabled ?? config.global.antiSpamEnabled,
    antiSpamBufferSeconds: guildConfig.antiSpamBufferSeconds ?? config.global.antiSpamBufferSeconds,
    antiSpamSameChannelRepeatThreshold: guildConfig.antiSpamSameChannelRepeatThreshold ?? config.global.antiSpamSameChannelRepeatThreshold,
    antiSpamUniqueChannelsThreshold: guildConfig.antiSpamUniqueChannelsThreshold ?? config.global.antiSpamUniqueChannelsThreshold,
    antiSpamSimilarityPercent: guildConfig.antiSpamSimilarityPercent ?? config.global.antiSpamSimilarityPercent,
    antiSpamMuteLengthMs: guildConfig.antiSpamMuteLengthMs ?? config.global.antiSpamMuteLengthMs,
    antiSpamOpenModerationThread: guildConfig.antiSpamOpenModerationThread ?? config.global.antiSpamOpenModerationThread,
    antiSpamLogDeletedMessages: guildConfig.antiSpamLogDeletedMessages ?? config.global.antiSpamLogDeletedMessages,
    antiSpamLoggingChannelId: guildConfig.antiSpamLoggingChannelId ?? config.global.antiSpamLoggingChannelId,
    moderationThreadMessage: guildConfig.moderationThreadMessage ?? config.global.moderationThreadMessage,
    honeyPotChannelMessage: guildConfig.honeyPotChannelMessage ?? config.global.honeyPotChannelMessage
  };
}

// getGuildSetupConfig defines this module's public behavior or core flow.
export function getGuildSetupConfig(config: BotConfig, guildId: string | null): GuildConfig {
  return guildId ? resolveGuildConfig(config, guildId) : config.global;
}

// applyGuildSetupConfig defines this module's public behavior or core flow.
export function applyGuildSetupConfig(config: BotConfig, guildId: string | null, patch: Partial<GuildConfig>): GuildConfig {
  if (!guildId) {
    throw new Error("Cannot apply guild setup config without a guild ID.");
  }

  const nextConfig: GuildConfig = {
    ...resolveGuildConfig(config, guildId),
    ...patch
  };

  config.guilds[guildId] = nextConfig;
  return nextConfig;
}

// writeConfigFile defines this module's public behavior or core flow.
async function writeConfigFile(config: BotConfig): Promise<void> {
  await mkdir(dirname(configFilePath), {recursive: true});
  await writeFile(configFilePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

// loadBotConfig defines this module's public behavior or core flow.
export async function loadBotConfig(): Promise<BotConfig> {
  await mkdir(dirname(configFilePath), {recursive: true});

  try {
    const rawConfig = await readFile(configFilePath, "utf8");
    const parsedConfig = JSON.parse(rawConfig) as unknown;
    return botConfigSchema.parse(parsedConfig);
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && (error as {code?: string}).code === "ENOENT") {
      await writeConfigFile(defaultBotConfig);
      return defaultBotConfig;
    }

    throw new Error(`Failed to load bot config from ${configFilePath}`, {cause: error});
  }
}

// saveBotConfig defines this module's public behavior or core flow.
export async function saveBotConfig(config: BotConfig): Promise<void> {
  await writeConfigFile(botConfigSchema.parse(config));
}