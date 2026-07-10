import {REST, Routes} from "discord.js";
import {env} from "../env.js";
import {slashCommands} from "../commands/index.js";

export async function registerApplicationCommands(): Promise<void> {
  const rest = new REST({version: "10"}).setToken(env.DISCORD_TOKEN);
  const payload = slashCommands.map((command) => command.data.toJSON());

  if (env.DISCORD_GUILD_ID) {
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_APPLICATION_ID, env.DISCORD_GUILD_ID), {body: payload});
    return;
  }

  await rest.put(Routes.applicationCommands(env.DISCORD_APPLICATION_ID), {body: payload});
}