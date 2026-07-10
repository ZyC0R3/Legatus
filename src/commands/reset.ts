/**
 * Module: reset
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction} from "discord.js";
import {defaultGuildConfig, type BotConfig} from "../config/schema.js";
import {applyGuildSetupConfig, saveBotConfig} from "../config/store.js";

export const resetCommand = {
  data: new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Reset parts of this server's Legatus configuration.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("setup")
        .setDescription("Reset this server's full setup back to defaults.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("profanity")
        .setDescription("Reset profanity term lists back to default values.")
    ),
  async execute(interaction: ChatInputCommandInteraction, botConfig?: BotConfig): Promise<void> {
    if (!interaction.inGuild() || !botConfig) {
      await interaction.reply({
        content: "Reset can only be run inside a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "setup") {
      delete botConfig.guilds[interaction.guildId];
      await saveBotConfig(botConfig);

      await interaction.reply({
        content: "Server setup has been reset to defaults and saved to config.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    applyGuildSetupConfig(botConfig, interaction.guildId, {
      profanityLowTerms: defaultGuildConfig.profanityLowTerms,
      profanityMediumTerms: defaultGuildConfig.profanityMediumTerms,
      profanityHighTerms: defaultGuildConfig.profanityHighTerms,
      profanityCriticalTerms: defaultGuildConfig.profanityCriticalTerms,
      profanityTermsConfigured: defaultGuildConfig.profanityTermsConfigured,
      profanityActiveLevels: defaultGuildConfig.profanityActiveLevels,
      profanityRules: defaultGuildConfig.profanityRules,
      profanityCleanup: defaultGuildConfig.profanityCleanup,
      profanityLogging: defaultGuildConfig.profanityLogging
    });
    await saveBotConfig(botConfig);

    await interaction.reply({
      content: "Profanity lists have been reset to default values and saved to config.",
      flags: MessageFlags.Ephemeral
    });
  }
};

export type ResetCommand = typeof resetCommand;
