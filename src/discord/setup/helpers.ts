import {ChannelType, PermissionFlagsBits} from "discord.js";
import {ChannelSelectMenuBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder} from "@discordjs/builders";
import type {GuildConfig} from "../../config/schema.js";
import {honeyPotNoValue, honeyPotSelectId, honeyPotYesValue} from "./constants.js";

export function selectedRoleIds(values: {values(): Iterable<{id: string} | null>} | null): string[] {
  return Array.from(values?.values() ?? [], (role) => role?.id).filter((roleId): roleId is string => typeof roleId === "string");
}

export function selectedSingleRoleId(values: {values(): Iterable<{id: string} | null>} | null): string | null {
  return Array.from(values?.values() ?? [], (role) => role?.id).find((roleId): roleId is string => typeof roleId === "string") ?? null;
}

export function selectedChannelId(values: {values(): Iterable<{id: string} | null>} | null): string | null {
  return Array.from(values?.values() ?? [], (channel) => channel?.id).find((channelId): channelId is string => typeof channelId === "string") ?? null;
}

export function isHoneyPotSelected(value: string | undefined): boolean {
  return (value ?? honeyPotNoValue) === honeyPotYesValue;
}

export function buildRoleSelect(customId: string, defaultRoles: readonly string[]): RoleSelectMenuBuilder {
  const builder = new RoleSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("Select roles")
    .setMinValues(0)
    .setMaxValues(25)
    .setRequired(false);

  if (defaultRoles.length > 0) {
    builder.setDefaultRoles(...defaultRoles);
  }

  return builder;
}

export function buildSingleRoleSelect(customId: string, defaultRoleId: string | null): RoleSelectMenuBuilder {
  const builder = new RoleSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder("Select one role")
    .setMinValues(1)
    .setMaxValues(1)
    .setRequired(true);

  if (defaultRoleId) {
    builder.setDefaultRoles(defaultRoleId);
  }

  return builder;
}

export function buildTextChannelSelect(customId: string, defaultChannelId: string | null, required: boolean): ChannelSelectMenuBuilder {
  const builder = new ChannelSelectMenuBuilder()
    .setCustomId(customId)
    .setMinValues(required ? 1 : 0)
    .setMaxValues(1)
    .setChannelTypes([ChannelType.GuildText])
    .setRequired(required);

  if (defaultChannelId) {
    builder.setDefaultChannels(defaultChannelId);
  }

  return builder;
}

export function buildHoneyPotSelect(): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(honeyPotSelectId)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel("Yes").setValue(honeyPotYesValue).setEmoji({"name": "✅"}),
      new StringSelectMenuOptionBuilder().setLabel("No").setValue(honeyPotNoValue).setEmoji({"name": "❌"})
    );
}

export function buildDurationSelect(customId: string, defaultValue: number, options: Array<{label: string; value: number}>): StringSelectMenuBuilder {
  const builder = new StringSelectMenuBuilder().setCustomId(customId).setMinValues(1).setMaxValues(1);

  for (const option of options) {
    builder.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(option.label)
        .setValue(String(option.value))
        .setDefault(option.value === defaultValue)
    );
  }

  return builder;
}

export function buildModerationChannelOverwrites(config: GuildConfig, everyoneRoleId: string) {
  const moderatorRoleIds = [...new Set([
    ...config.commandRoleIds,
    ...config.respondRoleIds,
    ...config.moderationMentionRoleIds
  ])];

  const moderatorAllow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.SendMessagesInThreads,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.AddReactions
  ];

  const everyoneOverwrite = config.isHoneyPotChannel
    ? {
        id: everyoneRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.SendMessagesInThreads,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.AddReactions
        ]
      }
    : {
        id: everyoneRoleId,
        deny: [PermissionFlagsBits.ViewChannel]
      };

  return [
    everyoneOverwrite,
    ...moderatorRoleIds.map((roleId) => ({
      id: roleId,
      allow: moderatorAllow
    }))
  ];
}

export function formatRoleList(roleIds: readonly string[]): string {
  return roleIds.length > 0 ? roleIds.map((roleId) => `<@&${roleId}>`).join(", ") : "Not set yet";
}

export function formatChannel(channelId: string | null): string {
  return channelId ? `<#${channelId}>` : "Not set yet";
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);

  if (totalSeconds % 604800 === 0) {
    return `${totalSeconds / 604800} week${totalSeconds / 604800 === 1 ? "" : "s"}`;
  }

  if (totalSeconds % 86400 === 0) {
    return `${totalSeconds / 86400} day${totalSeconds / 86400 === 1 ? "" : "s"}`;
  }

  if (totalSeconds % 3600 === 0) {
    return `${totalSeconds / 3600} hour${totalSeconds / 3600 === 1 ? "" : "s"}`;
  }

  if (totalSeconds % 60 === 0) {
    return `${totalSeconds / 60} minute${totalSeconds / 60 === 1 ? "" : "s"}`;
  }

  return `${totalSeconds} second${totalSeconds === 1 ? "" : "s"}`;
}
