/**
 * Module: profanity
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {SlashCommandBuilder, type ChatInputCommandInteraction} from "discord.js";
import type {BotConfig} from "../config/schema.js";
import {postProfanityPanel} from "../discord/profanity.js";

export const profanityCommand = {
  data: new SlashCommandBuilder()
    .setName("profanity")
    .setDescription("Post the profanity and banned words configuration panel."),
  async execute(interaction: ChatInputCommandInteraction, botConfig?: BotConfig): Promise<void> {
    await postProfanityPanel(interaction, botConfig);
  }
};
