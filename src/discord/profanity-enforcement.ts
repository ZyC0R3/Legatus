import {type GuildConfig} from "../config/schema.js";
import {type ModerationDetectionResult, buildRulePreview} from "../moderation/types.js";
import {openModerationThreadForViolation} from "./honey-pot.js";
import {formatDurationLabel} from "../moderation/types.js";
import {shouldBypassProfanityFilter} from "../permissions.js";

function pushAction(actions: string[], value: string): void {
  if (!actions.includes(value)) {
    actions.push(value);
  }
}

export async function applyProfanityActions(
  message: import("discord.js").Message,
  config: GuildConfig,
  result: ModerationDetectionResult
): Promise<string> {
  if (!result.matched || !result.severity || !message.guild || !message.member) {
    return "no-action";
  }

  const freshMember = await message.guild.members.fetch(message.author.id).catch(() => null);
  const memberForIgnoreCheck = freshMember ?? message.member;
  if (shouldBypassProfanityFilter(memberForIgnoreCheck, config)) {
    return "skipped-member";
  }

  const actions: string[] = [];
  const cleanup = config.profanityCleanup;
  const rules = config.profanityRules[result.severity];

  if (cleanup.deleteOriginalMessage) {
    const deleted = await message.delete().then(() => true).catch(() => false);
    if (deleted) {
      pushAction(actions, "deleted original message");
    }
  }

  if (cleanup.postMessageInChannel && cleanup.messageToPost.trim().length > 0) {
    const posted = "send" in message.channel
      ? await message.channel.send({content: cleanup.messageToPost}).then(() => true).catch(() => false)
      : false;
    if (posted) {
      pushAction(actions, "posted cleanup message");
    }
  }

  if (cleanup.addRoleId) {
    const added = await message.member.roles.add(cleanup.addRoleId, "Profanity cleanup action").then(() => true).catch(() => false);
    if (added) {
      pushAction(actions, `added role ${cleanup.addRoleId}`);
    }
  }

  if (cleanup.removeRoleId) {
    const removed = await message.member.roles.remove(cleanup.removeRoleId, "Profanity cleanup action").then(() => true).catch(() => false);
    if (removed) {
      pushAction(actions, `removed role ${cleanup.removeRoleId}`);
    }
  }

  if (rules.ban === true) {
    const banned = await message.guild.members.ban(message.author.id, {reason: `Profanity detection: ${result.matchedText}`}).then(() => true).catch(() => false);
    if (banned) {
      pushAction(actions, "banned user");
    }
  } else if (rules.kick === true) {
    const kicked = await message.member.kick(`Profanity detection: ${result.matchedText}`).then(() => true).catch(() => false);
    if (kicked) {
      pushAction(actions, "kicked user");
    }
  } else if (rules.muteLengthMs && rules.muteLengthMs > 0) {
    const muted = await message.member.timeout(rules.muteLengthMs, `Profanity detection: ${result.matchedText}`).then(() => true).catch(() => false);
    if (muted) {
      pushAction(actions, `muted for ${formatDurationLabel(rules.muteLengthMs)}`);
    }
  }

  if (rules.openThread === true) {
    const thread = await openModerationThreadForViolation(message, config, result.severity).catch(() => null);
    if (thread) {
      pushAction(actions, "opened moderation thread");
    }
  }

  if (actions.length > 0) {
    return actions.join(", ");
  }

  return buildRulePreview(rules);
}
