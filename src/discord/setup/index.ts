import {ContainerBuilder, MessageFlags, TextDisplayBuilder, type ButtonInteraction, type ChatInputCommandInteraction, type ModalSubmitInteraction} from "discord.js";
import type {BotConfig} from "../../config/schema.js";
import {getGuildSetupConfig} from "../../config/store.js";
import {getNextPhase, isCancelSetupButton} from "./flow.js";
import {cancelSetupSession, cloneGuildConfig, deleteSetupSession, getSetupSession, setSetupSession, updateWizardMessages} from "./session.js";
import {buildSetupCompleteEmbed, buildWizardComponents} from "./ui.js";
import {setupButtonIds} from "./constants.js";
import {handleRolesButton, handleRolesModal} from "./steps/roles.js";
import {handleAccessButton, handleAccessModal} from "./steps/access.js";
import {handleChannelsButton, handleChannelsModal} from "./steps/channels.js";
import {handleModerationButton, handleModerationModal} from "./steps/moderation.js";
import {handleTriggersButton, handleTriggersModal} from "./steps/triggers.js";

export async function startSetupWizard(interaction: ChatInputCommandInteraction, botConfig: BotConfig): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({content: "Legatus setup can only be run inside a server.", flags: MessageFlags.Ephemeral});
    return;
  }

  const userId = interaction.user.id;
  const originalGuildConfig = botConfig.guilds[guildId] ? cloneGuildConfig(botConfig.guilds[guildId]) : null;

  await interaction.reply({
    components: buildWizardComponents("roles"),
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
  });
  const setupMessage = await interaction.fetchReply();

  setSetupSession(guildId, userId, {
    hadGuildConfig: botConfig.guilds[guildId] !== undefined,
    originalGuildConfig,
    createdChannelIds: [],
    phase: "roles",
    wizardMessageId: setupMessage.id
  });
}

export async function handleSetupButton(interaction: ButtonInteraction, botConfig: BotConfig): Promise<boolean> {
  if (!interaction.inGuild()) {
    return false;
  }

  const session = getSetupSession(interaction.guildId, interaction.user.id);
  if (!session) {
    return false;
  }

  if (isCancelSetupButton(interaction.customId)) {
    await interaction.deferUpdate();
    await cancelSetupSession(interaction, botConfig, session);
    return true;
  }

  if (interaction.customId === setupButtonIds.next || interaction.customId === setupButtonIds.accessNext) {
    await interaction.deferUpdate();

    const nextPhase = getNextPhase(session.phase);
    if (nextPhase === "done") {
      const finalConfig = getGuildSetupConfig(botConfig, interaction.guildId);
      await interaction.webhook.editMessage(session.wizardMessageId, {
        components: [
          new ContainerBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent("Setup Completed\nSkipped remaining steps with no additional changes.")
          )
        ],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      }).catch(() => undefined);

      deleteSetupSession(interaction.guildId, interaction.user.id);
      await interaction.followUp({
        embeds: [buildSetupCompleteEmbed(finalConfig)],
        flags: MessageFlags.Ephemeral
      }).catch(() => undefined);
      return true;
    }

    session.phase = nextPhase;
    await updateWizardMessages(interaction, session, buildWizardComponents(session.phase));
    return true;
  }

  if (await handleRolesButton(interaction, botConfig, interaction.guildId, session.phase)) {
    return true;
  }

  if (await handleAccessButton(interaction, botConfig, interaction.guildId, session.phase)) {
    return true;
  }

  if (await handleChannelsButton(interaction, session.phase)) {
    return true;
  }

  if (await handleModerationButton(interaction, botConfig, interaction.guildId, session.phase)) {
    return true;
  }

  if (await handleTriggersButton(interaction, botConfig, interaction.guildId, session.phase)) {
    return true;
  }

  return false;
}

export async function handleSetupModal(interaction: ModalSubmitInteraction, botConfig: BotConfig): Promise<boolean> {
  if (!interaction.inGuild()) {
    return false;
  }

  const session = getSetupSession(interaction.guildId, interaction.user.id);
  if (!session) {
    return false;
  }

  if (await handleRolesModal(interaction, botConfig, session, () => buildWizardComponents(session.phase))) {
    return true;
  }

  if (await handleAccessModal(interaction, botConfig, session, () => buildWizardComponents(session.phase))) {
    return true;
  }

  if (await handleChannelsModal(interaction, botConfig, session, () => buildWizardComponents(session.phase))) {
    return true;
  }

  if (await handleModerationModal(interaction, botConfig, session, () => buildWizardComponents(session.phase))) {
    return true;
  }

  if (await handleTriggersModal(interaction, botConfig, session, () => buildWizardComponents(session.phase))) {
    deleteSetupSession(interaction.guildId, interaction.user.id);
    return true;
  }

  return false;
}
