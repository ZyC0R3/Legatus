/**
 * Module: session
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {type Client, MessageFlags, type ButtonInteraction, type ModalSubmitInteraction, ContainerBuilder, TextDisplayBuilder} from "discord.js";
import type {BotConfig, GuildOverrideConfig} from "../../config/schema.js";
import {saveBotConfig} from "../../config/store.js";
import type {SetupSession} from "./types.js";

const setupSessions = new Map<string, SetupSession>();
const setupSessionTtlMs = 15 * 60 * 1000;

// nextSetupSessionExpiry defines this module's public behavior or core flow.
function nextSetupSessionExpiry(now = Date.now()): number {
  return now + setupSessionTtlMs;
}

// pruneExpiredSetupSessions defines this module's public behavior or core flow.
function pruneExpiredSetupSessions(now = Date.now()): void {
  for (const [key, session] of setupSessions.entries()) {
    if (session.expiresAt <= now) {
      setupSessions.delete(key);
    }
  }
}

// setupSessionKey defines this module's public behavior or core flow.
export function setupSessionKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

// cloneGuildConfig defines this module's public behavior or core flow.
export function cloneGuildConfig<T extends GuildOverrideConfig | null>(config: T): T {
  return structuredClone(config);
}

// getSetupSession defines this module's public behavior or core flow.
export function getSetupSession(guildId: string, userId: string): SetupSession | null {
  pruneExpiredSetupSessions();
  const session = setupSessions.get(setupSessionKey(guildId, userId)) ?? null;
  if (!session) {
    return null;
  }

  session.expiresAt = nextSetupSessionExpiry();
  return session;
}

// setSetupSession defines this module's public behavior or core flow.
export function setSetupSession(guildId: string, userId: string, session: SetupSession): void {
  pruneExpiredSetupSessions();
  session.expiresAt = nextSetupSessionExpiry();
  setupSessions.set(setupSessionKey(guildId, userId), session);
}

// deleteSetupSession defines this module's public behavior or core flow.
export function deleteSetupSession(guildId: string, userId: string): void {
  setupSessions.delete(setupSessionKey(guildId, userId));
}

// cleanupCreatedChannels defines this module's public behavior or core flow.
async function cleanupCreatedChannels(client: Client, guildId: string, channelIds: string[]): Promise<void> {
  const guild = client.guilds.cache.get(guildId) ?? await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) {
    return;
  }

  await Promise.allSettled(channelIds.map(async (channelId) => {
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    if (channel && "delete" in channel) {
      await channel.delete("Legatus setup cancelled; removing channels created during setup").catch(() => undefined);
    }
  }));
}

// cancelSetupSession defines this module's public behavior or core flow.
export async function cancelSetupSession(interaction: ButtonInteraction, botConfig: BotConfig, session: SetupSession): Promise<void> {
  const guildId = interaction.guildId!;

  if (session.hadGuildConfig && session.originalGuildConfig) {
    botConfig.guilds[guildId] = cloneGuildConfig(session.originalGuildConfig);
  } else {
    delete botConfig.guilds[guildId];
  }

  await cleanupCreatedChannels(interaction.client, guildId, session.createdChannelIds);
  await saveBotConfig(botConfig);

  await interaction.webhook.editMessage(session.wizardMessageId, {
    components: [
      new ContainerBuilder().addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Setup Cancelled\nAll setup changes were reverted.")
      )
    ],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
  }).catch(() => undefined);

  deleteSetupSession(guildId, interaction.user.id);
}

// updateWizardMessages defines this module's public behavior or core flow.
export async function updateWizardMessages(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  session: SetupSession,
  components: ContainerBuilder[]
): Promise<void> {
  session.expiresAt = nextSetupSessionExpiry();
  await interaction.webhook.editMessage(session.wizardMessageId, {
    components,
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
  }).catch(() => undefined);
}
