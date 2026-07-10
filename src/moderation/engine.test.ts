import test from "node:test";
import assert from "node:assert/strict";
import {defaultGuildConfig, type GuildConfig} from "../config/schema.js";
import {buildModerationEngine} from "./engine.js";

function configForTest(patch: Partial<GuildConfig>): GuildConfig {
  return {
    ...defaultGuildConfig,
    ...patch
  };
}

test("detects exact word match", () => {
  const engine = buildModerationEngine(configForTest({
    profanityLowTerms: "toenail",
    profanityActiveLevels: ["low"]
  }));

  const result = engine.evaluate("that user is a toenail");
  assert.equal(result.matched, true);
  if (result.matched) {
    assert.equal(result.severity, "low");
    assert.equal(result.detectionMethod, "exact-word");
    assert.equal(result.matchedText, "toenail");
  }
});

test("returns highest severity when multiple levels match", () => {
  const engine = buildModerationEngine(configForTest({
    profanityLowTerms: "toenail",
    profanityHighTerms: "murder",
    profanityActiveLevels: ["low", "high"]
  }));

  const result = engine.evaluate("toenail and murder");
  assert.equal(result.matched, true);
  if (result.matched) {
    assert.equal(result.severity, "high");
    assert.equal(result.matchedText, "murder");
  }
});

test("detects exact phrase match", () => {
  const engine = buildModerationEngine(configForTest({
    profanityHighTerms: "how to kill",
    profanityActiveLevels: ["high"]
  }));

  const result = engine.evaluate("Can you show me how to kill in this game?");
  assert.equal(result.matched, true);
  if (result.matched) {
    assert.equal(result.detectionMethod, "exact-phrase");
  }
});

test("detects unicode and separator bypasses via compact stage", () => {
  const engine = buildModerationEngine(configForTest({
    profanityLowTerms: "fuck",
    profanityActiveLevels: ["low"]
  }));

  const result = engine.evaluate("f.u.c.k");
  assert.equal(result.matched, true);
  if (result.matched) {
    assert.equal(result.detectionMethod, "compact");
  }
});

test("detects leetspeak substitutions", () => {
  const engine = buildModerationEngine(configForTest({
    profanityLowTerms: "shit",
    profanityActiveLevels: ["low"]
  }));

  const result = engine.evaluate("sh1t happens");
  assert.equal(result.matched, true);
});

test("detects repeated character abuse through fuzzy stage", () => {
  const engine = buildModerationEngine(configForTest({
    profanityLowTerms: "fuck",
    profanityActiveLevels: ["low"]
  }));

  const result = engine.evaluate("fuuuuuck that");
  assert.equal(result.matched, true);
  if (result.matched) {
    assert.equal(result.detectionMethod, "fuzzy");
  }
});

test("detects optional regex filters", () => {
  const engine = buildModerationEngine(configForTest({
    profanityMediumTerms: "re:\\bfoo\\d{2}\\b",
    profanityActiveLevels: ["medium"]
  }));

  const result = engine.evaluate("input foo12 now");
  assert.equal(result.matched, true);
  if (result.matched) {
    assert.equal(result.detectionMethod, "regex");
    assert.equal(result.severity, "medium");
  }
});

test("detects fuzzy typos", () => {
  const engine = buildModerationEngine(configForTest({
    profanityLowTerms: "toenail",
    profanityActiveLevels: ["low"]
  }));

  const result = engine.evaluate("you are a toenaol");
  assert.equal(result.matched, true);
  if (result.matched) {
    assert.equal(result.detectionMethod, "fuzzy");
  }
});

test("avoids common false positives", () => {
  const engine = buildModerationEngine(configForTest({
    profanityLowTerms: "ass, hell",
    profanityActiveLevels: ["low"]
  }));

  const result = engine.evaluate("class shell hallway");
  assert.equal(result.matched, false);
});

test("does not trigger when list is inactive", () => {
  const engine = buildModerationEngine(configForTest({
    profanityLowTerms: "toenail",
    profanityActiveLevels: []
  }));

  const result = engine.evaluate("toenail");
  assert.equal(result.matched, false);
});
