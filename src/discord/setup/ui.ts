/**
 * Module: ui
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {ContainerBuilder, EmbedBuilder} from "discord.js";
import type {GuildConfig} from "../../config/schema.js";
import type {SetupPhase} from "./types.js";
import {buildChannelsContainer} from "./steps/channels.js";
import {buildModerationContainer} from "./steps/moderation.js";
import {buildRolesContainer} from "./steps/roles.js";
import {buildTriggersContainer} from "./steps/triggers.js";
import {buildAccessContainer} from "./steps/access.js";
import {formatChannel, formatDuration, formatRoleList} from "./helpers.js";

// buildSetupCompleteEmbed defines this module's public behavior or core flow.
export function buildSetupCompleteEmbed(config: GuildConfig): EmbedBuilder {
  const passwordScope = config.accessPasswordChannelId ? `<#${config.accessPasswordChannelId}>` : "Any text channel";
  const emojiScope = config.accessEmojiChannelId ? `<#${config.accessEmojiChannelId}>` : "Not set";
  const welcomeScope = config.accessWelcomeMessageChannelId ? `<#${config.accessWelcomeMessageChannelId}>` : "Trigger channel";
  const joinLeaveLogScope = config.accessJoinLeaveLoggingChannelId ? `<#${config.accessJoinLeaveLoggingChannelId}>` : "Not set";
  const fields = [
    {name: "Head Moderator Roles", value: formatRoleList(config.commandRoleIds), inline: false},
    {name: "Moderator Roles", value: formatRoleList(config.respondRoleIds), inline: false},
    {name: "Allowed Roles for Moderation Mention", value: formatRoleList(config.moderationMentionRoleIds), inline: false},
    {name: "Join Role", value: config.joinRoleId ? `<@&${config.joinRoleId}>` : "Not set yet", inline: false},
    {name: "Do Not Ping Roles", value: formatRoleList(config.moderationNoPingRoleIds), inline: false},
    {name: "Ignored Roles", value: formatRoleList(config.ignoredRoleIds), inline: false},
    {
      name: "Access Password",
      value: config.accessPasswordPhrase
        ? `Configured (channel: ${passwordScope}, add role: ${config.accessPasswordRoleId ? `<@&${config.accessPasswordRoleId}>` : "Not set"}, remove role: ${config.accessPasswordRemoveRoleId ? `<@&${config.accessPasswordRemoveRoleId}>` : "Not set"})`
        : "Not set",
      inline: false
    },
    {
      name: "Access Emoji",
      value: config.accessEmojiValue
        ? `Configured (${config.accessEmojiValue}) in ${emojiScope}, add role: ${config.accessEmojiRoleId ? `<@&${config.accessEmojiRoleId}>` : "Not set"}, remove role: ${config.accessEmojiRemoveRoleId ? `<@&${config.accessEmojiRemoveRoleId}>` : "Not set"}`
        : "Not set",
      inline: false
    },
    {
      name: "Access Welcome Message",
      value: config.accessWelcomeMessage
        ? `Configured in ${welcomeScope}`
        : "Not set",
      inline: false
    },
    {
      name: "Access Join/Leave Logging",
      value: config.accessJoinLeaveLogging !== "none"
        ? `${config.accessJoinLeaveLogging} in ${joinLeaveLogScope}`
        : "Disabled",
      inline: false
    },
    {name: "Mode", value: config.moderationChannelMode ?? "Not set yet", inline: false},
    {name: "Moderation Channel", value: formatChannel(config.moderationChannelId), inline: false},
    {name: "Category", value: formatChannel(config.moderationCategoryId), inline: false},
    {name: "Honey Pot", value: config.isHoneyPotChannel ? "Yes" : "No", inline: false}
  ];

  if (config.isHoneyPotChannel) {
    fields.push(
      {name: "Mute Timeout", value: formatDuration(config.moderationTimeoutMs), inline: false},
      {name: "Honey Pot Channel Message", value: config.honeyPotChannelMessage || "Not set yet", inline: false}
    );
  }

  fields.push(
    {name: "Message Deletion Window", value: formatDuration(config.messageDeletionWindowMs), inline: false},
    {name: "Moderation Thread Message", value: config.moderationThreadMessage || "Not set yet", inline: false}
  );

  return new EmbedBuilder()
    .setTitle("Setup Confirmed")
    .setDescription("Legatus setup has been completed.")
    .addFields(...fields);
}

// buildWizardComponents defines this module's public behavior or core flow.
export function buildWizardComponents(phase: SetupPhase): ContainerBuilder[] {
  return [
    buildRolesContainer(phase),
    buildAccessContainer(phase),
    buildChannelsContainer(phase),
    buildModerationContainer(phase),
    buildTriggersContainer(phase)
  ];
}
