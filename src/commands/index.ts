/**
 * Module: index
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {profanityCommand} from "./profanity.js";
import {resetCommand} from "./reset.js";
import {setupCommand} from "./setup.js";

export const slashCommands = [setupCommand, resetCommand, profanityCommand];

export const slashCommandMap = new Map(slashCommands.map((command) => [command.data.name, command] as const));