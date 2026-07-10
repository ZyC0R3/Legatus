/**
 * Module: setup
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {SlashCommandBuilder, type ChatInputCommandInteraction} from "discord.js";
import type {BotConfig} from "../config/schema.js";
import {startSetupWizard} from "../discord/setup.js";

export const setupCommand = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Start or edit the Legatus setup wizard."),
  async execute(interaction: ChatInputCommandInteraction, botConfig?: BotConfig): Promise<void> {
    if (!interaction.inGuild() || !botConfig) {
      await interaction.reply({content: "Legatus setup can only be run inside a server.", ephemeral: true});
      return;
    }

    await startSetupWizard(interaction, botConfig);
  }
};