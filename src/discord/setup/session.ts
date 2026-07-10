import {type Client, MessageFlags, type ButtonInteraction, type ModalSubmitInteraction, ContainerBuilder, TextDisplayBuilder} from "discord.js";
import type {BotConfig, GuildConfig} from "../../config/schema.js";
import {saveBotConfig} from "../../config/store.js";
import type {SetupSession} from "./types.js";

const setupSessions = new Map<string, SetupSession>();

export function setupSessionKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

export function cloneGuildConfig(config: GuildConfig): GuildConfig {
  return structuredClone(config);
}

export function getSetupSession(guildId: string, userId: string): SetupSession | null {
  return setupSessions.get(setupSessionKey(guildId, userId)) ?? null;
}

export function setSetupSession(guildId: string, userId: string, session: SetupSession): void {
  setupSessions.set(setupSessionKey(guildId, userId), session);
}

export function deleteSetupSession(guildId: string, userId: string): void {
  setupSessions.delete(setupSessionKey(guildId, userId));
}

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

export async function updateWizardMessages(
  interaction: ButtonInteraction | ModalSubmitInteraction,
  session: SetupSession,
  components: ContainerBuilder[]
): Promise<void> {
  await interaction.webhook.editMessage(session.wizardMessageId, {
    components,
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
  }).catch(() => undefined);
}
