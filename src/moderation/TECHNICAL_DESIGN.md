# High-Performance Moderation Detection Engine Design

## Goals
- Evaluate every incoming Discord message with minimal latency and CPU overhead.
- Determine only detection outcome and highest severity; do not execute moderation actions.
- Support dynamic list updates without bot restart.
- Keep architecture testable and extensible.

## Severity Model
- Levels: `low`, `medium`, `high`, `critical`.
- Match resolution always returns the highest matched level.
- Evaluation order is descending severity: critical -> high -> medium -> low.

## Input Model
Term sources are guild configuration fields:
- `profanityLowTerms`
- `profanityMediumTerms`
- `profanityHighTerms`
- `profanityCriticalTerms`
- `profanityActiveLevels`

Optional administrator regex filters are supported inside term lists using `re:` prefix.
Examples:
- `re:\bfo+bar\b`
- `re:(?:kill|murder)\s+you`

## Chosen Architecture
A staged, short-circuiting runtime pipeline backed by startup preprocessing.

### Stage 0: Fast reject
- Reject empty/whitespace-only messages.
- Reject messages with no alphanumeric code points.
Complexity: O(n) scan with no allocations beyond counters.

### Stage 1: Canonical normalization (single pass)
Build reusable normalized representations once per message:
- Lowercase
- Unicode NFKD normalization
- Strip combining marks
- Confusable + leetspeak folding (`@ -> a`, `0 -> o`, `$ -> s`, etc.)
- Replace separators/punctuation with spaces
- Collapse repeated characters (e.g. `fuuuuuck -> fuuck` then `fuck` through token canonicalization)
Outputs:
- `normalizedMessage` (space-preserving)
- `compactMessage` (alphanumeric only)
- `tokens` (split on spaces, filtered empties)
Complexity: O(n)

### Stage 2: Exact word detection (hot path)
- Use per-severity `Set<string>` for O(1) token membership checks.
- Iterate tokens once, descending severity.
Complexity: O(t), where `t` is token count.

### Stage 3: Phrase detection
- Pre-index phrases by first token: `Map<string, PhraseEntry[]>`.
- At runtime, for each token, only evaluate candidate phrases sharing same first token.
Complexity: Average O(t * k), where `k` is small candidate count per first token.

### Stage 4: Compact bypass detection
- Detect split/obfuscated phrases against `compactMessage` with compact term forms.
- Handles bypasses like `f.u.c.k`, `f u c k`, zero-width separators.
Complexity: O(c * m) worst-case (`c` compact terms, `m` message size), but constrained by active-level terms and short-circuiting.

### Stage 5: Regex filters (optional, admin-defined)
- Regex compiled during engine build only.
- Runtime executes only regexes for active levels and only after fast deterministic checks.
Complexity: Depends on regex; mitigated by post-fast-stage ordering and compilation validation.

### Stage 6: Fuzzy matching (last stage)
- Use BK-tree per severity for fuzzy token matching with bounded edit distance.
- Query only for tokens of practical length (`>=4`) and distance threshold by token length.
Complexity: Sublinear average in candidate space, worst-case O(n) in degenerate trees.

## Data Structures
Per severity:
- `singleWordSet: Set<string>`
- `phraseIndex: Map<string, PhraseEntry[]>`
- `compactTerms: string[]`
- `regexRules: RegExp[]`
- `fuzzyTree: BKTree` built from eligible single words

Global runtime object:
- `ModerationEngine`
- `ModerationEngineManager` with guild-level cache
  - key: guildId
  - value: `{ fingerprint, engine }`

## Dynamic Updates While Bot Is Running
No restart needed.
- A stable fingerprint is computed from active levels and term strings.
- On each message, manager compares current fingerprint with cached fingerprint.
- Rebuild occurs only if fingerprint changed.
- Profanity panel edits already mutate in-memory config and save to JSON; next message sees updated config.

## Why These Algorithms
Selected:
- Hash sets for exact words: fastest practical hot path for token matches.
- First-token phrase index: lower overhead than full automata for moderate phrase dictionaries and dynamic rebuilds.
- BK-tree for fuzzy: efficient candidate pruning for approximate matches.
- Canonical normalization pipeline: captures most bypasses cheaply.

Rejected (for now):
- Full Aho-Corasick automaton:
  - Excellent theoretical performance but higher implementation/maintenance overhead for boundary-sensitive word + phrase + dynamic updates.
  - Better justified at much larger dictionary sizes or static corpora.
- Per-message Levenshtein over all terms:
  - Too expensive for high-throughput message streams.
- Trie-only approach for all logic:
  - Complex for phrase boundaries + bypass canonicalization + regex coexistence compared to mixed strategy.

## Expected Complexity Summary
Per message:
- Normalize/tokenize: O(n)
- Exact words: O(t)
- Phrase stage: near O(t) average
- Compact stage: O(c * m) bounded by short-circuit and active levels
- Regex: O(r * m) in configured subset
- Fuzzy: O(q * logV) average (q queried tokens, V vocabulary), worst-case O(q * V)

## Potential Bottlenecks
- Overly broad or catastrophic regex patterns.
- Extremely large compact term sets if all levels become huge.
- Fuzzy stage under pathological vocabularies.

Mitigations:
- Keep regex optional and post-fast stages.
- Gate fuzzy by token length and dynamic threshold.
- Short-circuit immediately on highest-severity match.

## Scalability
Future upgrades:
- Swap phrase stage with Aho-Corasick without changing external engine interface.
- Add weighted confidence scoring and multi-match output.
- Add per-guild metrics (stage timings, match rates) for tuning.

## Result Contract
Engine returns strongly typed result with:
- `matched`
- `severity`
- `category`
- `matchedText`
- `detectionMethod`
- `originalMessage`
- `normalizedMessage`

No moderation actions executed by this engine.
