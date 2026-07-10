/**
 * Module: roles
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, TextDisplayBuilder, type ButtonInteraction, type MessageActionRowComponentBuilder, type ModalSubmitInteraction} from "discord.js";
import {LabelBuilder, ModalBuilder, TextDisplayBuilder as ModalTextDisplayBuilder} from "@discordjs/builders";
import type {BotConfig, GuildConfig} from "../../../config/schema.js";
import {applyGuildSetupConfig, getGuildSetupConfig, saveBotConfig} from "../../../config/store.js";
import {headModeratorRolesId, ignoredRolesId, moderationMentionRolesId, moderatorRolesId, setupButtonIds, setupModalId} from "../constants.js";
import {buildRoleSelect, selectedRoleIds} from "../helpers.js";
import type {SetupSession} from "../types.js";
import {updateWizardMessages} from "../session.js";

// buildRolesContainer defines this module's public behavior or core flow.
export function buildRolesContainer(phase: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Welcome to Legatus, moderation bot."),
      new TextDisplayBuilder().setContent(
        [
          "Restrictions and Permissions",
          "Below you can configure roles and permissions for Legatus."
        ].join("\n")
      )
    );

  if (phase === "roles") {
    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Set Roles").setCustomId(setupButtonIds.setRoles),
        new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Next").setCustomId(setupButtonIds.next),
        new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel("Cancel").setCustomId(setupButtonIds.cancelRoles)
      )
    );
  }

  return container;
}

// buildRoleModal defines this module's public behavior or core flow.
export function buildRoleModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(setupModalId)
    .setTitle("Restrictions and Permissions")
    .addTextDisplayComponents(
      new ModalTextDisplayBuilder().setContent("Below you can configure roles and permissions for Legatus. Permissions are hierarchical, so roles assigned to higher levels automatically inherit the permissions of lower levels. For example, a role selected as Head Moderator does not need to be selected again as Moderator. However, roles assigned as Moderator will not receive Head Moderator permissions.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Head Moderator Role")
        .setDescription("These roles will restrict usage of the set-up command for future use.")
        .setRoleSelectMenuComponent(buildRoleSelect(headModeratorRolesId, config.commandRoleIds)),
      new LabelBuilder()
        .setLabel("Moderator Role")
        .setDescription("Pick the roles that will be able to see the moderation channels that are opened by the bot.")
        .setRoleSelectMenuComponent(buildRoleSelect(moderatorRolesId, config.respondRoleIds)),
      new LabelBuilder()
        .setLabel("Allowed roles for Moderation Mention")
        .setDescription("This allows the defined roles to @Legatus replying to a message to trigger moderation action.")
        .setRoleSelectMenuComponent(
          buildRoleSelect(moderationMentionRolesId, config.moderationMentionRoleIds)
            .setPlaceholder("If none selected, any user can @legatus")
        ),
      new LabelBuilder()
        .setLabel("Ignored Roles")
        .setDescription("These roles will be ignored from all moderation actions, but they wont have moderation permissions.")
        .setRoleSelectMenuComponent(buildRoleSelect(ignoredRolesId, config.ignoredRoleIds))
    );
}

// handleRolesButton defines this module's public behavior or core flow.
export async function handleRolesButton(interaction: ButtonInteraction, botConfig: BotConfig, guildId: string, phase: string): Promise<boolean> {
  if (interaction.customId !== setupButtonIds.setRoles) {
    return false;
  }

  if (phase !== "roles") {
    await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
    return true;
  }

  const config = getGuildSetupConfig(botConfig, guildId);
  await interaction.showModal(buildRoleModal(config));
  return true;
}

// handleRolesModal defines this module's public behavior or core flow.
export async function handleRolesModal(
  interaction: ModalSubmitInteraction,
  botConfig: BotConfig,
  session: SetupSession,
  buildComponents: () => ContainerBuilder[]
): Promise<boolean> {
  if (interaction.customId !== setupModalId) {
    return false;
  }

  if (session.phase !== "roles") {
    await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
    return true;
  }

  await interaction.deferReply({flags: MessageFlags.Ephemeral});

  applyGuildSetupConfig(botConfig, interaction.guildId, {
    commandRoleIds: selectedRoleIds(interaction.fields.getSelectedRoles(headModeratorRolesId)),
    respondRoleIds: selectedRoleIds(interaction.fields.getSelectedRoles(moderatorRolesId)),
    moderationMentionRoleIds: selectedRoleIds(interaction.fields.getSelectedRoles(moderationMentionRolesId)),
    ignoredRoleIds: selectedRoleIds(interaction.fields.getSelectedRoles(ignoredRolesId))
  });
  await saveBotConfig(botConfig);

  session.phase = "access";
  await updateWizardMessages(interaction, session, buildComponents());
  await interaction.deleteReply().catch(() => undefined);
  return true;
}
