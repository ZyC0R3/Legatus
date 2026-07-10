/**
 * Module: types
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import type {GuildConfig} from "../../config/schema.js";

export type SetupPhase = "roles" | "access" | "channels" | "moderation" | "triggers" | "done";

export type SetupSession = {
  hadGuildConfig: boolean;
  originalGuildConfig: GuildConfig | null;
  createdChannelIds: string[];
  phase: SetupPhase;
  wizardMessageId: string;
};
