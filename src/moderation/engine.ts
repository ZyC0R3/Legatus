/**
 * Module: engine
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {type GuildConfig, type ProfanityLevel} from "../config/schema.js";
import {BKTree, boundedLevenshtein} from "./bk-tree.js";
import {foldLeetToken, normalizeTerm, normalizeText, squashRepeats} from "./normalize.js";
import {type DetectionMethod, type ModerationDetectionResult, severityDescending} from "./types.js";

type PhraseEntry = {
  term: string;
  tokens: string[];
};

type CompactEntry = {
  term: string;
  compact: string;
};

type LevelIndex = {
  words: Set<string>;
  phrasesByFirstToken: Map<string, PhraseEntry[]>;
  separatorRegexes: Array<{term: string; regex: RegExp}>;
  compactTerms: CompactEntry[];
  regexes: Array<{source: string; regex: RegExp}>;
  fuzzyWords: BKTree;
};

export interface ModerationEngine {
  evaluate(message: string): ModerationDetectionResult;
}

// parseTerms defines this module's public behavior or core flow.
function parseTerms(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

// parseRegexRule defines this module's public behavior or core flow.
function parseRegexRule(entry: string): {source: string; regex: RegExp} | null {
  if (!entry.startsWith("re:")) {
    return null;
  }

  const candidate = entry.slice(3).trim();
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith("/") && candidate.length > 2) {
    const lastSlash = candidate.lastIndexOf("/");
    if (lastSlash > 0) {
      const pattern = candidate.slice(1, lastSlash);
      const flags = candidate.slice(lastSlash + 1);
      try {
        return {source: entry, regex: new RegExp(pattern, flags.includes("u") ? flags : `${flags}u`)};
      } catch {
        return null;
      }
    }
  }

  try {
    return {source: entry, regex: new RegExp(candidate, "iu")};
  } catch {
    return null;
  }
}

// fuzzyThreshold defines this module's public behavior or core flow.
function fuzzyThreshold(tokenLength: number): number {
  if (tokenLength >= 10) {
    return 2;
  }
  if (tokenLength >= 4) {
    return 1;
  }
  return 0;
}

// termListForLevel defines this module's public behavior or core flow.
function termListForLevel(config: GuildConfig, level: ProfanityLevel): string {
  if (level === "low") {
    return config.profanityLowTerms;
  }
  if (level === "medium") {
    return config.profanityMediumTerms;
  }
  if (level === "high") {
    return config.profanityHighTerms;
  }
  return config.profanityCriticalTerms;
}

// buildLevelIndex defines this module's public behavior or core flow.
function buildLevelIndex(rawTerms: string[]): LevelIndex {
  const words = new Set<string>();
  const phrasesByFirstToken = new Map<string, PhraseEntry[]>();
  const separatorRegexes: Array<{term: string; regex: RegExp}> = [];
  const compactTerms: CompactEntry[] = [];
  const regexes: Array<{source: string; regex: RegExp}> = [];
  const fuzzyWords = new BKTree(boundedLevenshtein);

  for (const rawEntry of rawTerms) {
    const regexRule = parseRegexRule(rawEntry);
    if (regexRule) {
      regexes.push(regexRule);
      continue;
    }

    const normalized = normalizeTerm(rawEntry);
    if (!normalized) {
      continue;
    }

    if (normalized.includes(" ")) {
      const phraseTokens = normalized.split(" ").filter((token) => token.length > 0);
      if (phraseTokens.length < 2) {
        continue;
      }

      const compact = normalized.replace(/\s+/g, "");
      if (compact.length >= 4) {
        compactTerms.push({term: normalized, compact});
      }

      const first = phraseTokens[0] ?? "";
      const existing = phrasesByFirstToken.get(first);
      const phraseEntry = {term: normalized, tokens: phraseTokens};

      if (existing) {
        existing.push(phraseEntry);
      } else {
        phrasesByFirstToken.set(first, [phraseEntry]);
      }
      continue;
    }

    words.add(normalized);

    if (normalized.length >= 4) {
      const separatorPattern = normalized.split("").join("\\W+");
      separatorRegexes.push({
        term: normalized,
        regex: new RegExp(`\\b${separatorPattern}\\b`, "i")
      });
    }

    if (normalized.length >= 4) {
      fuzzyWords.insert(normalized);
    }
  }

  return {
    words,
    phrasesByFirstToken,
    separatorRegexes,
    compactTerms,
    regexes,
    fuzzyWords
  };
}

// matchedResult defines this module's public behavior or core flow.
function matchedResult(
  message: string,
  normalizedMessage: string,
  severity: ProfanityLevel,
  matchedText: string,
  detectionMethod: DetectionMethod
): ModerationDetectionResult {
  return {
    matched: true,
    severity,
    category: "profanity",
    matchedText,
    detectionMethod,
    originalMessage: message,
    normalizedMessage
  };
}

// buildModerationEngine defines this module's public behavior or core flow.
export function buildModerationEngine(config: GuildConfig): ModerationEngine {
  const enabledLevels = new Set(config.profanityActiveLevels);

  const perLevel = new Map<ProfanityLevel, LevelIndex>();

  for (const level of severityDescending) {
    if (!enabledLevels.has(level)) {
      continue;
    }

    const normalizedTerms = parseTerms(termListForLevel(config, level));
    perLevel.set(level, buildLevelIndex(normalizedTerms));
  }

  return {
    evaluate(message: string): ModerationDetectionResult {
      const normalized = normalizeText(message);
      const normalizedMessage = normalized.normalized;

      if (!normalizedMessage) {
        return {
          matched: false,
          severity: null,
          category: "profanity",
          matchedText: null,
          detectionMethod: null,
          originalMessage: message,
          normalizedMessage
        };
      }

      if (normalized.tokens.length === 0) {
        return {
          matched: false,
          severity: null,
          category: "profanity",
          matchedText: null,
          detectionMethod: null,
          originalMessage: message,
          normalizedMessage
        };
      }

      const leetTokens = normalized.tokens.map((token) => foldLeetToken(token));

      for (const level of severityDescending) {
        const levelIndex = perLevel.get(level);
        if (!levelIndex) {
          continue;
        }

        for (const token of normalized.tokens) {
          if (levelIndex.words.has(token) || levelIndex.words.has(foldLeetToken(token))) {
            return matchedResult(message, normalizedMessage, level, token, "exact-word");
          }
        }
      }

      for (const level of severityDescending) {
        const levelIndex = perLevel.get(level);
        if (!levelIndex) {
          continue;
        }

        for (let index = 0; index < normalized.tokens.length; index += 1) {
          const token = normalized.tokens[index] ?? "";
          const candidates = levelIndex.phrasesByFirstToken.get(token)
            ?? levelIndex.phrasesByFirstToken.get(leetTokens[index] ?? "");
          if (!candidates || candidates.length === 0) {
            continue;
          }

          for (const candidate of candidates) {
            const phraseLength = candidate.tokens.length;
            let matched = true;

            for (let offset = 0; offset < phraseLength; offset += 1) {
              const left = normalized.tokens[index + offset] ?? "";
              const leftLeet = leetTokens[index + offset] ?? "";
              const right = candidate.tokens[offset] ?? "";
              if (left !== right && leftLeet !== right) {
                matched = false;
                break;
              }
            }

            if (matched) {
              return matchedResult(message, normalizedMessage, level, candidate.term, "exact-phrase");
            }
          }
        }
      }

      for (const level of severityDescending) {
        const levelIndex = perLevel.get(level);
        if (!levelIndex) {
          continue;
        }

        for (const candidate of levelIndex.separatorRegexes) {
          candidate.regex.lastIndex = 0;
          if (candidate.regex.test(normalizedMessage)) {
            return matchedResult(message, normalizedMessage, level, candidate.term, "compact");
          }
        }
      }

      for (const level of severityDescending) {
        const levelIndex = perLevel.get(level);
        if (!levelIndex) {
          continue;
        }

        for (const candidate of levelIndex.compactTerms) {
          if (normalized.compact.includes(candidate.compact)) {
            return matchedResult(message, normalizedMessage, level, candidate.term, "compact");
          }
        }
      }

      for (const level of severityDescending) {
        const levelIndex = perLevel.get(level);
        if (!levelIndex) {
          continue;
        }

        for (const rule of levelIndex.regexes) {
          rule.regex.lastIndex = 0;
          if (rule.regex.test(normalizedMessage)) {
            return matchedResult(message, normalizedMessage, level, rule.source, "regex");
          }
        }
      }

      for (const level of severityDescending) {
        const levelIndex = perLevel.get(level);
        if (!levelIndex) {
          continue;
        }

        for (const token of normalized.tokens) {
          const squashedToken = squashRepeats(token);
          const threshold = fuzzyThreshold(squashedToken.length);
          if (threshold < 1) {
            continue;
          }

          const fuzzyMatch = levelIndex.fuzzyWords.search(squashedToken, threshold);
          if (fuzzyMatch
            && fuzzyMatch[0] === squashedToken[0]
            && fuzzyMatch[fuzzyMatch.length - 1] === squashedToken[squashedToken.length - 1]) {
            return matchedResult(message, normalizedMessage, level, fuzzyMatch, "fuzzy");
          }
        }
      }

      return {
        matched: false,
        severity: null,
        category: "profanity",
        matchedText: null,
        detectionMethod: null,
        originalMessage: message,
        normalizedMessage
      };
    }
  };
}
