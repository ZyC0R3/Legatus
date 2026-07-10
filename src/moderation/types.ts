import {type ProfanityLevel, type ProfanityRuleConfig} from "../config/schema.js";

export type DetectionMethod = "exact-word" | "exact-phrase" | "compact" | "regex" | "fuzzy";

export interface ModerationMatchResult {
  matched: true;
  severity: ProfanityLevel;
  category: "profanity";
  matchedText: string;
  detectionMethod: DetectionMethod;
  originalMessage: string;
  normalizedMessage: string;
}

export interface ModerationNoMatchResult {
  matched: false;
  severity: null;
  category: "profanity";
  matchedText: null;
  detectionMethod: null;
  originalMessage: string;
  normalizedMessage: string;
}

export type ModerationDetectionResult = ModerationMatchResult | ModerationNoMatchResult;

export const severityDescending: readonly ProfanityLevel[] = ["critical", "high", "medium", "low"];

export function formatDurationLabel(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);

  if (totalSeconds % 604800 === 0) {
    const weeks = totalSeconds / 604800;
    return `${weeks} week${weeks === 1 ? "" : "s"}`;
  }

  if (totalSeconds % 86400 === 0) {
    const days = totalSeconds / 86400;
    return `${days} day${days === 1 ? "" : "s"}`;
  }

  if (totalSeconds % 3600 === 0) {
    const hours = totalSeconds / 3600;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  if (totalSeconds % 60 === 0) {
    const minutes = totalSeconds / 60;
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
}

export function buildRulePreview(rule: ProfanityRuleConfig): string {
  const actions: string[] = [];

  if (rule.muteLengthMs && rule.muteLengthMs > 0) {
    actions.push(`mute:${formatDurationLabel(rule.muteLengthMs)}`);
  }
  if (rule.kick === true) {
    actions.push("kick");
  }
  if (rule.ban === true) {
    actions.push("ban");
  }
  if (rule.openThread === true) {
    actions.push("open-thread");
  }

  return actions.length > 0 ? actions.join(", ") : "no-actions-configured";
}
