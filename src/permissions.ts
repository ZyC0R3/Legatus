/**
 * Module: permissions
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import type {GuildConfig} from "./config/schema.js";
import type {GuildMember} from "discord.js";

// hasAnyRole defines this module's public behavior or core flow.
function hasAnyRole(member: GuildMember, roleIds: readonly string[]): boolean {
  if (roleIds.length === 0) {
    return true;
  }

  return member.roles.cache.some((role) => roleIds.includes(role.id));
}

// shouldIgnoreMember defines this module's public behavior or core flow.
export function shouldIgnoreMember(member: GuildMember, config: GuildConfig): boolean {
  return config.ignoredUserIds.includes(member.user.id) || member.roles.cache.some((role) => config.ignoredRoleIds.includes(role.id));
}

// hasExplicitRole defines this module's public behavior or core flow.
function hasExplicitRole(member: GuildMember, roleIds: readonly string[]): boolean {
  if (roleIds.length === 0) {
    return false;
  }

  return member.roles.cache.some((role) => roleIds.includes(role.id));
}

// shouldBypassProfanityFilter defines this module's public behavior or core flow.
export function shouldBypassProfanityFilter(member: GuildMember, config: GuildConfig): boolean {
  if (shouldIgnoreMember(member, config)) {
    return true;
  }

  return hasExplicitRole(member, config.commandRoleIds) || hasExplicitRole(member, config.respondRoleIds);
}

// canUseCommands defines this module's public behavior or core flow.
export function canUseCommands(member: GuildMember, config: GuildConfig): boolean {
  return hasAnyRole(member, config.commandRoleIds);
}

// shouldRespondToMessages defines this module's public behavior or core flow.
export function shouldRespondToMessages(member: GuildMember, config: GuildConfig): boolean {
  return hasAnyRole(member, config.respondRoleIds);
}