/**
 * Module: setup
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction} from "discord.js";
import type {BotConfig} from "../config/schema.js";
import {startSetupWizard} from "../discord/setup.js";

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Start or edit the Legatus setup wizard."),
  async execute(interaction: ChatInputCommandInteraction, botConfig?: BotConfig): Promise<void> {
    if (!interaction.inGuild() || !botConfig) {
      await interaction.reply({content: "Legatus setup can only be run inside a server.", flags: MessageFlags.Ephemeral});
      return;
    }

    // Acknowledge immediately to avoid interaction timeout before the wizard payload is posted.
    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    await startSetupWizard(interaction, botConfig);
  }
};