/**
 * Module: moderation
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, TextDisplayBuilder, type ButtonInteraction, type MessageActionRowComponentBuilder, type ModalSubmitInteraction} from "discord.js";
import {LabelBuilder, ModalBuilder} from "@discordjs/builders";
import type {BotConfig, GuildConfig} from "../../../config/schema.js";
import {applyGuildSetupConfig, getGuildSetupConfig, saveBotConfig} from "../../../config/store.js";
import {messageDeletionWindowSelectId, moderationConfigModalId, moderationNoPingRolesId, moderationTimeoutSelectId, setupButtonIds} from "../constants.js";
import {buildDurationSelect, buildRoleSelect, selectedRoleIds} from "../helpers.js";
import {updateWizardMessages} from "../session.js";
import type {SetupSession} from "../types.js";

// buildModerationContainer defines this module's public behavior or core flow.
export function buildModerationContainer(phase: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Moderation Configurations",
          "Set the moderation timeout and message deletion window used by the automation."
        ].join("\n")
      )
    );

  if (phase === "moderation") {
    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Set-up").setCustomId(setupButtonIds.setModerationConfig),
        new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Next").setCustomId(setupButtonIds.next),
        new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel("Cancel").setCustomId(setupButtonIds.cancelModeration)
      )
    );
  }

  return container;
}

// buildModerationConfigModal defines this module's public behavior or core flow.
export function buildModerationConfigModal(config: GuildConfig): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(moderationConfigModalId)
    .setTitle("Moderation Configurations")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Message Deletion Window")
        .setDescription("This is the amount of time the bot will review message to delete when moderating")
        .setStringSelectMenuComponent(
          buildDurationSelect(messageDeletionWindowSelectId, config.messageDeletionWindowMs, [
            {label: "1 Min", value: 60 * 1000},
            {label: "2 Mins", value: 2 * 60 * 1000},
            {label: "3 Mins", value: 3 * 60 * 1000},
            {label: "5 Mins", value: 5 * 60 * 1000},
            {label: "15 Mins", value: 15 * 60 * 1000},
            {label: "1 Hour", value: 60 * 60 * 1000}
          ])
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("DO NOT PING")
        .setDescription("The roles selected in this section will not be pinged by the bot.")
        .setRoleSelectMenuComponent(
          buildRoleSelect(moderationNoPingRolesId, config.moderationNoPingRoleIds)
        )
    );

  if (config.isHoneyPotChannel) {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Time out Length")
        .setDescription("Set the of time-out length for users who triggering moderation in the honey pot channel.")
        .setStringSelectMenuComponent(
          buildDurationSelect(moderationTimeoutSelectId, config.moderationTimeoutMs, [
            {label: "60 Secs", value: 60 * 1000},
            {label: "5 Mins", value: 5 * 60 * 1000},
            {label: "10 Mins", value: 10 * 60 * 1000},
            {label: "1 Hour", value: 60 * 60 * 1000},
            {label: "1 Day", value: 24 * 60 * 60 * 1000},
            {label: "1 Week", value: 7 * 24 * 60 * 60 * 1000}
          ])
        )
    );
  }

  return modal;
}

// handleModerationButton defines this module's public behavior or core flow.
export async function handleModerationButton(interaction: ButtonInteraction, botConfig: BotConfig, guildId: string, phase: string): Promise<boolean> {
  if (interaction.customId !== setupButtonIds.setModerationConfig) {
    return false;
  }

  if (phase !== "moderation") {
    await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
    return true;
  }

  const config = getGuildSetupConfig(botConfig, guildId);
  await interaction.showModal(buildModerationConfigModal(config));
  return true;
}

// handleModerationModal defines this module's public behavior or core flow.
export async function handleModerationModal(
  interaction: ModalSubmitInteraction,
  botConfig: BotConfig,
  session: SetupSession,
  buildComponents: () => ContainerBuilder[]
): Promise<boolean> {
  if (interaction.customId !== moderationConfigModalId) {
    return false;
  }

  if (session.phase !== "moderation") {
    await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
    return true;
  }

  await interaction.deferReply({flags: MessageFlags.Ephemeral});

  const currentConfig = getGuildSetupConfig(botConfig, interaction.guildId);
  const timeoutMs = currentConfig.isHoneyPotChannel
    ? Number(interaction.fields.getStringSelectValues(moderationTimeoutSelectId)[0] ?? String(60 * 60 * 1000))
    : currentConfig.moderationTimeoutMs;
  const deletionWindowMs = Number(interaction.fields.getStringSelectValues(messageDeletionWindowSelectId)[0] ?? String(60 * 1000));

  applyGuildSetupConfig(botConfig, interaction.guildId, {
    moderationTimeoutMs: timeoutMs,
    messageDeletionWindowMs: deletionWindowMs,
    moderationNoPingRoleIds: selectedRoleIds(interaction.fields.getSelectedRoles(moderationNoPingRolesId))
  });
  await saveBotConfig(botConfig);

  session.phase = "triggers";
  await updateWizardMessages(interaction, session, buildComponents());
  await interaction.deleteReply().catch(() => undefined);
  return true;
}
