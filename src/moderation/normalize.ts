export interface NormalizedMessage {
  normalized: string;
  compact: string;
  tokens: string[];
}

const charFoldMap: Record<string, string> = {
  "@": "a",
  "$": "s",
  "!": "i",
  "|": "i",
  "ı": "i",
  "ȷ": "j",
  "ο": "o",
  "а": "a",
  "е": "e",
  "і": "i",
  "ѕ": "s"
};

function isAsciiAlphaNum(value: string): boolean {
  const code = value.charCodeAt(0);
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
}

function collapseRuns(input: string): string {
  if (input.length < 3) {
    return input;
  }

  let output = "";
  let previous = "";
  let count = 0;

  for (let i = 0; i < input.length; i += 1) {
    const current = input[i] ?? "";
    if (current === previous) {
      count += 1;
    } else {
      previous = current;
      count = 1;
    }

    if (count <= 2) {
      output += current;
    }
  }

  return output;
}

export function squashRepeats(input: string): string {
  if (input.length < 3) {
    return input;
  }

  let output = "";
  let previous = "";

  for (let i = 0; i < input.length; i += 1) {
    const current = input[i] ?? "";
    if (current !== previous) {
      output += current;
      previous = current;
    }
  }

  return output;
}

export function normalizeText(input: string): NormalizedMessage {
  const source = input.toLowerCase().normalize("NFKD").replace(/\p{M}+/gu, "");
  let normalized = "";
  let previousWasSpace = true;

  for (let i = 0; i < source.length; i += 1) {
    const current = source[i] ?? "";
    const mapped = charFoldMap[current] ?? current;

    for (let j = 0; j < mapped.length; j += 1) {
      const part = mapped[j] ?? "";
      const collapsed = collapseRuns(part);

      for (let k = 0; k < collapsed.length; k += 1) {
        const char = collapsed[k] ?? "";
        if (isAsciiAlphaNum(char)) {
          normalized += char;
          previousWasSpace = false;
          continue;
        }

        if (!previousWasSpace) {
          normalized += " ";
          previousWasSpace = true;
        }
      }
    }
  }

  normalized = normalized.trim();

  const tokens = normalized.length > 0
    ? normalized.split(" ").filter((token) => token.length > 0)
    : [];

  const compact = normalized.replace(/\s+/g, "");

  return {
    normalized,
    compact,
    tokens
  };
}

export function normalizeTerm(input: string): string {
  return normalizeText(input).normalized;
}

const leetMap: Record<string, string> = {
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
  "@": "a",
  "$": "s",
  "!": "i",
  "|": "i"
};

export function foldLeetToken(input: string): string {
  if (input.length === 0) {
    return input;
  }

  let output = "";
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i] ?? "";
    output += leetMap[char] ?? char;
  }
  return output;
}
