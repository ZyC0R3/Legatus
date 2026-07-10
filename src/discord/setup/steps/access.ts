/**
 * Module: access
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, TextDisplayBuilder, TextInputStyle, type ButtonInteraction, type MessageActionRowComponentBuilder, type ModalSubmitInteraction} from "discord.js";
import {LabelBuilder, ModalBuilder, TextDisplayBuilder as ModalTextDisplayBuilder, TextInputBuilder} from "@discordjs/builders";
import type {BotConfig, GuildConfig} from "../../../config/schema.js";
import {applyGuildSetupConfig, getGuildSetupConfig, saveBotConfig} from "../../../config/store.js";
import {
  accessEmojiChannelId,
  accessEmojiMessageOrIdId,
  accessEmojiModalId,
  accessEmojiRoleId,
  accessEmojiValueId,
  accessPasswordChannelId,
  accessPasswordModalId,
  accessPasswordPhraseId,
  accessPasswordRoleId,
  setupButtonIds
} from "../constants.js";
import {buildSingleRoleSelect, buildTextChannelSelect, selectedChannelId, selectedSingleRoleId} from "../helpers.js";
import {updateWizardMessages} from "../session.js";
import type {SetupSession} from "../types.js";

// buildAccessContainer defines this module's public behavior or core flow.
export function buildAccessContainer(phase: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Access control",
          "Here you can define a Password or emoji reaction to trigger a users access."
        ].join("\n")
      )
    );

  if (phase === "access") {
    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Password / Phrase").setCustomId(setupButtonIds.setAccessPassword),
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Emoji").setCustomId(setupButtonIds.setAccessEmoji),
        new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Next").setCustomId(setupButtonIds.accessNext),
        new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel("Cancel").setCustomId(setupButtonIds.cancelAccess)
      )
    );
  }

  return container;
}

// buildAccessPasswordModal defines this module's public behavior or core flow.
export function buildAccessPasswordModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setTitle("Access Control - Password")
    .setCustomId(accessPasswordModalId)
    .addTextDisplayComponents(
      new ModalTextDisplayBuilder()
        .setContent("Define a Password or Phrase to trigger a role to be added to users to allow access to the server.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Password or Phrase")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(accessPasswordPhraseId)
            .setStyle(TextInputStyle.Short)
            .setValue(config.accessPasswordPhrase)
            .setRequired(true)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Role to Assign")
        .setRoleSelectMenuComponent(buildSingleRoleSelect(accessPasswordRoleId, config.accessPasswordRoleId))
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Restrict to Channel")
        .setChannelSelectMenuComponent(buildTextChannelSelect(accessPasswordChannelId, config.accessPasswordChannelId, false))
    );
}

// buildAccessEmojiModal defines this module's public behavior or core flow.
export function buildAccessEmojiModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setTitle("Access Control - Emoji")
    .setCustomId(accessEmojiModalId)
    .addTextDisplayComponents(
      new ModalTextDisplayBuilder()
        .setContent("Define an emoji trigger so a role is added to users when they react.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Message or Message ID")
        .setDescription("Use an 18 or 19 digit message ID, or type a message to post for reactions.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(accessEmojiMessageOrIdId)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.accessEmojiMessageContent)
            .setRequired(true)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Enter the Emoji")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(accessEmojiValueId)
            .setStyle(TextInputStyle.Short)
            .setValue(config.accessEmojiValue)
            .setRequired(true)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Role to Assign")
        .setRoleSelectMenuComponent(buildSingleRoleSelect(accessEmojiRoleId, config.accessEmojiRoleId))
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Apply to Channel")
        .setChannelSelectMenuComponent(buildTextChannelSelect(accessEmojiChannelId, config.accessEmojiChannelId, true))
    );
}

// handleAccessButton defines this module's public behavior or core flow.
export async function handleAccessButton(interaction: ButtonInteraction, botConfig: BotConfig, guildId: string, phase: string): Promise<boolean> {
  if (interaction.customId === setupButtonIds.setAccessPassword) {
    if (phase !== "access") {
      await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
      return true;
    }

    const config = getGuildSetupConfig(botConfig, guildId);
    await interaction.showModal(buildAccessPasswordModal(config));
    return true;
  }

  if (interaction.customId === setupButtonIds.setAccessEmoji) {
    if (phase !== "access") {
      await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
      return true;
    }

    const config = getGuildSetupConfig(botConfig, guildId);
    await interaction.showModal(buildAccessEmojiModal(config));
    return true;
  }

  return false;
}

// handleAccessModal defines this module's public behavior or core flow.
export async function handleAccessModal(
  interaction: ModalSubmitInteraction,
  botConfig: BotConfig,
  session: SetupSession,
  buildComponents: () => ContainerBuilder[]
): Promise<boolean> {
  if (interaction.customId === accessPasswordModalId) {
    if (session.phase !== "access") {
      await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
      return true;
    }

    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    const phrase = interaction.fields.getTextInputValue(accessPasswordPhraseId).trim();
    const roleId = selectedSingleRoleId(interaction.fields.getSelectedRoles(accessPasswordRoleId));
    const channelId = selectedChannelId(interaction.fields.getSelectedChannels(accessPasswordChannelId, false));

    if (!phrase || !roleId) {
      await interaction.editReply({content: "Password/Phrase and role are required."});
      return true;
    }

    applyGuildSetupConfig(botConfig, interaction.guildId, {
      accessPasswordPhrase: phrase,
      accessPasswordRoleId: roleId,
      accessPasswordChannelId: channelId
    });
    await saveBotConfig(botConfig);

    await updateWizardMessages(interaction, session, buildComponents());
    await interaction.deleteReply().catch(() => undefined);
    return true;
  }

  if (interaction.customId !== accessEmojiModalId) {
    return false;
  }

  if (session.phase !== "access") {
    await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
    return true;
  }

  await interaction.deferReply({flags: MessageFlags.Ephemeral});

  const messageOrIdInput = interaction.fields.getTextInputValue(accessEmojiMessageOrIdId).trim();
  const emojiValue = interaction.fields.getTextInputValue(accessEmojiValueId).trim();
  const roleId = selectedSingleRoleId(interaction.fields.getSelectedRoles(accessEmojiRoleId));
  const channelId = selectedChannelId(interaction.fields.getSelectedChannels(accessEmojiChannelId, false));

  if (!emojiValue || !roleId || !channelId) {
    await interaction.editReply({content: "Emoji, role, and apply channel are required."});
    return true;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({content: "Could not resolve the server."});
    return true;
  }

  const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !("send" in channel) || !("messages" in channel)) {
    await interaction.editReply({content: "Could not resolve the selected text channel."});
    return true;
  }

  const looksLikeMessageId = /^\d{18,19}$/.test(messageOrIdInput);

  if (looksLikeMessageId) {
    const targetMessage = await channel.messages.fetch(messageOrIdInput).catch(() => null);
    if (!targetMessage) {
      await interaction.editReply({content: "Could not find that message ID in the selected channel."});
      return true;
    }

    const reacted = await targetMessage.react(emojiValue).catch(() => null);
    if (!reacted) {
      await interaction.editReply({content: "Could not apply that emoji to the target message."});
      return true;
    }

    applyGuildSetupConfig(botConfig, interaction.guildId, {
      accessEmojiValue: emojiValue,
      accessEmojiRoleId: roleId,
      accessEmojiChannelId: channelId,
      accessEmojiMessageId: targetMessage.id,
      accessEmojiMessageContent: ""
    });
    await saveBotConfig(botConfig);

    await updateWizardMessages(interaction, session, buildComponents());
    await interaction.deleteReply().catch(() => undefined);
    return true;
  }

  if (!messageOrIdInput) {
    await interaction.editReply({content: "Message content is required when no message ID is provided."});
    return true;
  }

  const postedMessage = await channel.send(messageOrIdInput).catch(() => null);
  if (!postedMessage) {
    await interaction.editReply({content: "Could not post the access message in the selected channel."});
    return true;
  }

  const reacted = await postedMessage.react(emojiValue).catch(() => null);
  if (!reacted) {
    await interaction.editReply({content: "Message posted but failed to apply the emoji trigger."});
    return true;
  }

  applyGuildSetupConfig(botConfig, interaction.guildId, {
    accessEmojiValue: emojiValue,
    accessEmojiRoleId: roleId,
    accessEmojiChannelId: channelId,
    accessEmojiMessageId: postedMessage.id,
    accessEmojiMessageContent: messageOrIdInput
  });
  await saveBotConfig(botConfig);

  await updateWizardMessages(interaction, session, buildComponents());
  await interaction.deleteReply().catch(() => undefined);
  return true;
}
