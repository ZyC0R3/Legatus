/**
 * Module: client
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {Client, GatewayIntentBits, Options, Partials} from "discord.js";

// createDiscordClient defines this module's public behavior or core flow.
export function createDiscordClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User, Partials.Reaction],
    makeCache: Options.cacheWithLimits({
      MessageManager: 50,
      UserManager: 100
    })
  });
}