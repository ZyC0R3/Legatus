import {setupButtonIds} from "./constants.js";
import type {SetupPhase} from "./types.js";

export function isCancelSetupButton(customId: string): boolean {
  return customId === setupButtonIds.cancelRoles
    || customId === setupButtonIds.cancelAccess
    || customId === setupButtonIds.cancelChannels
    || customId === setupButtonIds.cancelModeration
    || customId === setupButtonIds.cancelTriggers;
}

export function getNextPhase(phase: SetupPhase): SetupPhase {
  if (phase === "roles") {
    return "access";
  }

  if (phase === "access") {
    return "channels";
  }

  if (phase === "channels") {
    return "moderation";
  }

  if (phase === "moderation") {
    return "triggers";
  }

  return "done";
}
