/**
 * Module: flow
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {setupButtonIds} from "./constants.js";
import type {SetupPhase} from "./types.js";

// isCancelSetupButton defines this module's public behavior or core flow.
export function isCancelSetupButton(customId: string): boolean {
  return customId === setupButtonIds.cancelRoles
    || customId === setupButtonIds.cancelAccess
    || customId === setupButtonIds.cancelChannels
    || customId === setupButtonIds.cancelModeration
    || customId === setupButtonIds.cancelTriggers;
}

// getNextPhase defines this module's public behavior or core flow.
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
