import type {GuildConfig} from "./config/schema.js";
import type {GuildMember} from "discord.js";

function hasAnyRole(member: GuildMember, roleIds: readonly string[]): boolean {
  if (roleIds.length === 0) {
    return true;
  }

  return member.roles.cache.some((role) => roleIds.includes(role.id));
}

export function shouldIgnoreMember(member: GuildMember, config: GuildConfig): boolean {
  return config.ignoredUserIds.includes(member.user.id) || member.roles.cache.some((role) => config.ignoredRoleIds.includes(role.id));
}

function hasExplicitRole(member: GuildMember, roleIds: readonly string[]): boolean {
  if (roleIds.length === 0) {
    return false;
  }

  return member.roles.cache.some((role) => roleIds.includes(role.id));
}

export function shouldBypassProfanityFilter(member: GuildMember, config: GuildConfig): boolean {
  if (shouldIgnoreMember(member, config)) {
    return true;
  }

  return hasExplicitRole(member, config.commandRoleIds) || hasExplicitRole(member, config.respondRoleIds);
}

export function canUseCommands(member: GuildMember, config: GuildConfig): boolean {
  return hasAnyRole(member, config.commandRoleIds);
}

export function shouldRespondToMessages(member: GuildMember, config: GuildConfig): boolean {
  return hasAnyRole(member, config.respondRoleIds);
}