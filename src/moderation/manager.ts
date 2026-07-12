/**
 * Module: manager
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {type BotConfig, type GuildConfig} from "../config/schema.js";
import {resolveGuildConfig} from "../config/store.js";
import {buildModerationEngine, type ModerationEngine} from "./engine.js";
import {type ModerationDetectionResult, severityDescending} from "./types.js";

type CachedEngine = {
  fingerprint: string;
  engine: ModerationEngine;
};

// buildConfigFingerprint defines this module's public behavior or core flow.
function buildConfigFingerprint(config: GuildConfig): string {
  const orderedLevels = severityDescending.filter((level) => config.profanityActiveLevels.includes(level));
  return [
    orderedLevels.join("|"),
    config.profanityLowTerms,
    config.profanityMediumTerms,
    config.profanityHighTerms,
    config.profanityCriticalTerms
  ].join("||");
}

// ModerationEngineManager defines this module's public behavior or core flow.
export class ModerationEngineManager {
  private readonly cache = new Map<string, CachedEngine>();

  public warm(botConfig: BotConfig): void {
    const globalFingerprint = buildConfigFingerprint(botConfig.global);
    this.cache.set("global", {
      fingerprint: globalFingerprint,
      engine: buildModerationEngine(botConfig.global)
    });

    for (const guildId of Object.keys(botConfig.guilds)) {
      const guildConfig = resolveGuildConfig(botConfig, guildId);
      const fingerprint = buildConfigFingerprint(guildConfig);
      this.cache.set(guildId, {
        fingerprint,
        engine: buildModerationEngine(guildConfig)
      });
    }
  }

  public evaluate(guildId: string | null, config: GuildConfig, message: string): ModerationDetectionResult {
    const cacheKey = guildId ?? "global";
    const fingerprint = buildConfigFingerprint(config);
    const cached = this.cache.get(cacheKey);

    if (!cached || cached.fingerprint !== fingerprint) {
      const rebuilt = {
        fingerprint,
        engine: buildModerationEngine(config)
      };
      this.cache.set(cacheKey, rebuilt);
      return rebuilt.engine.evaluate(message);
    }

    return cached.engine.evaluate(message);
  }
}
