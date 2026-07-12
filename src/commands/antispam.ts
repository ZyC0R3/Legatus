/**
 * Module: antispam
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction} from "discord.js";
import type {BotConfig} from "../config/schema.js";
import {applyGuildSetupConfig, saveBotConfig} from "../config/store.js";
import {showAntiSpamPanel} from "../discord/antispam-panel.js";

export const antispamCommand = {
  data: new SlashCommandBuilder()
    .setName("antispam")
    .setDescription("Configure anti-spam burst protection.")
    .addBooleanOption((option) =>
      option
        .setName("active")
        .setDescription("Enable or disable anti-spam protection.")
        .setRequired(false)
    ),
  async execute(interaction: ChatInputCommandInteraction, botConfig?: BotConfig): Promise<void> {
    if (!interaction.inGuild() || !botConfig) {
      await interaction.reply({
        content: "Anti-spam can only be configured inside a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const active = interaction.options.getBoolean("active", false);

    if (active !== null) {
      applyGuildSetupConfig(botConfig, interaction.guildId, {
        antiSpamEnabled: active
      });
      await saveBotConfig(botConfig);

      await interaction.reply({
        content: `Anti-spam protection is now ${active ? "enabled" : "disabled"}.`,
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await showAntiSpamPanel(interaction);
  }
};
