/**
 * Module: index
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {loadBotConfig} from "./config/store.js";
import {env} from "./env.js";
import {createDiscordClient} from "./discord/client.js";
import {bindDiscordHandlers} from "./discord/handlers.js";

const botConfig = await loadBotConfig();
const client = createDiscordClient();

bindDiscordHandlers(client, botConfig);

process.on("SIGINT", async () => {
  await client.destroy();
  process.exit(0);
});

await client.login(env.DISCORD_TOKEN);