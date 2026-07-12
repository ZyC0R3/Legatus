/**
 * Module: access
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ContainerBuilder, MessageFlags, TextDisplayBuilder, TextInputStyle, type ButtonInteraction, type MessageActionRowComponentBuilder, type ModalSubmitInteraction} from "discord.js";
import {ChannelSelectMenuBuilder, LabelBuilder, ModalBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextDisplayBuilder as ModalTextDisplayBuilder, TextInputBuilder} from "@discordjs/builders";
import type {BotConfig, GuildConfig} from "../../../config/schema.js";
import {applyGuildSetupConfig, getGuildSetupConfig, saveBotConfig} from "../../../config/store.js";
import {
  accessEmojiRemoveRoleId,
  accessExtrasModalId,
  accessEmojiChannelId,
  accessJoinAndLeaveValue,
  accessJoinLeaveLoggingChannelId,
  accessJoinLeaveLoggingId,
  accessJoinOnlyValue,
  accessLeaveOnlyValue,
  accessEmojiMessageOrIdId,
  accessEmojiModalId,
  accessEmojiRoleId,
  accessEmojiValueId,
  accessPasswordRemoveRoleId,
  accessWelcomeMessageChannelId,
  accessWelcomeMessageId,
  accessPasswordChannelId,
  accessPasswordModalId,
  accessPasswordPhraseId,
  accessPasswordRoleId,
  setupButtonIds
} from "../constants.js";
import {buildOptionalSingleRoleSelect, buildSingleRoleSelect, buildTextChannelSelect, selectedChannelId, selectedSingleRoleId} from "../helpers.js";
import {updateWizardMessages} from "../session.js";
import type {SetupSession} from "../types.js";

// toJoinLeaveMode defines this module's public behavior or core flow.
function toJoinLeaveMode(value: string | undefined): GuildConfig["accessJoinLeaveLogging"] {
  if (value === accessJoinOnlyValue) {
    return "join";
  }

  if (value === accessLeaveOnlyValue) {
    return "leave";
  }

  if (value === accessJoinAndLeaveValue) {
    return "both";
  }

  return "none";
}

// fromJoinLeaveMode defines this module's public behavior or core flow.
function fromJoinLeaveMode(mode: GuildConfig["accessJoinLeaveLogging"]): string | null {
  if (mode === "join") {
    return accessJoinOnlyValue;
  }

  if (mode === "leave") {
    return accessLeaveOnlyValue;
  }

  if (mode === "both") {
    return accessJoinAndLeaveValue;
  }

  return null;
}

// buildAccessContainer defines this module's public behavior or core flow.
export function buildAccessContainer(phase: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Access control",
          "Here you can define a password or emoji reaction to trigger a user's access."
        ].join("\n")
      )
    );

  if (phase === "access") {
    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Password / Phrase").setCustomId(setupButtonIds.setAccessPassword),
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Emoji").setCustomId(setupButtonIds.setAccessEmoji),
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Extras").setCustomId(setupButtonIds.setAccessExtras),
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
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Password or Phrase")
        .setDescription("Define a password or phrase that adds a role and grants server access.")
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
        .setLabel("Role to Remove")
        .setRoleSelectMenuComponent(buildOptionalSingleRoleSelect(accessPasswordRemoveRoleId, config.accessPasswordRemoveRoleId))
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
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Message or Message ID")
        .setDescription("Use an 18- or 19-digit message ID, or type a message to post for reactions.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(accessEmojiMessageOrIdId)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.accessEmojiMessageContent)
            .setRequired(false)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Enter the emoji")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(accessEmojiValueId)
            .setStyle(TextInputStyle.Short)
            .setValue(config.accessEmojiValue)
            .setRequired(false)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Role to Assign")
        .setRoleSelectMenuComponent(buildSingleRoleSelect(accessEmojiRoleId, config.accessEmojiRoleId))
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Role to Remove")
        .setRoleSelectMenuComponent(buildOptionalSingleRoleSelect(accessEmojiRemoveRoleId, config.accessEmojiRemoveRoleId))
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Restrict to Channel")
        .setChannelSelectMenuComponent(buildTextChannelSelect(accessEmojiChannelId, config.accessEmojiChannelId, false))
    );
}

// buildAccessExtrasModal defines this module's public behavior or core flow.
export function buildAccessExtrasModal(config: GuildConfig): ModalBuilder {
  const defaultLogging = fromJoinLeaveMode(config.accessJoinLeaveLogging);

  const loggingSelect = new StringSelectMenuBuilder()
    .setCustomId(accessJoinLeaveLoggingId)
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel("Join Only")
        .setValue(accessJoinOnlyValue)
        .setDescription("Log all user join actions")
        .setDefault(defaultLogging === accessJoinOnlyValue),
      new StringSelectMenuOptionBuilder()
        .setLabel("Leave Only")
        .setValue(accessLeaveOnlyValue)
        .setDescription("Log all user leave actions")
        .setDefault(defaultLogging === accessLeaveOnlyValue),
      new StringSelectMenuOptionBuilder()
        .setLabel("Join and Leave")
        .setValue(accessJoinAndLeaveValue)
        .setDescription("Log all user join and leave actions")
        .setDefault(defaultLogging === accessJoinAndLeaveValue)
    );

  const loggingChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(accessJoinLeaveLoggingChannelId)
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(1)
    .setChannelTypes([ChannelType.GuildText]);

  if (config.accessJoinLeaveLoggingChannelId) {
    loggingChannelSelect.setDefaultChannels(config.accessJoinLeaveLoggingChannelId);
  }

  return new ModalBuilder()
    .setTitle("Access Control - Extras")
    .setCustomId(accessExtrasModalId)
    .addTextDisplayComponents(
      new ModalTextDisplayBuilder()
        .setContent("These extra settings apply to one or more access control types.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Welcome Message")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(accessWelcomeMessageId)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.accessWelcomeMessage)
            .setRequired(false)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Welcome Message Channel")
        .setDescription("If none is provided, the welcome message will be posted in the channel where the action was completed.")
        .setChannelSelectMenuComponent(buildTextChannelSelect(accessWelcomeMessageChannelId, config.accessWelcomeMessageChannelId, false))
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Logging")
        .setStringSelectMenuComponent(loggingSelect)
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Join and Leave Logging Channel")
        .setChannelSelectMenuComponent(loggingChannelSelect)
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

  if (interaction.customId === setupButtonIds.setAccessExtras) {
    if (phase !== "access") {
      await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
      return true;
    }

    const config = getGuildSetupConfig(botConfig, guildId);
    await interaction.showModal(buildAccessExtrasModal(config));
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
    const removeRoleId = selectedSingleRoleId(interaction.fields.getSelectedRoles(accessPasswordRemoveRoleId));
    const channelId = selectedChannelId(interaction.fields.getSelectedChannels(accessPasswordChannelId, false));

    if (!phrase || !roleId) {
      await interaction.editReply({content: "Password/Phrase and role are required."});
      return true;
    }

    applyGuildSetupConfig(botConfig, interaction.guildId, {
      accessPasswordPhrase: phrase,
      accessPasswordRoleId: roleId,
      accessPasswordRemoveRoleId: removeRoleId,
      accessPasswordChannelId: channelId
    });
    await saveBotConfig(botConfig);

    await updateWizardMessages(interaction, session, buildComponents());
    await interaction.deleteReply().catch(() => undefined);
    return true;
  }

  if (interaction.customId === accessExtrasModalId) {
    if (session.phase !== "access") {
      await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
      return true;
    }

    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    const welcomeMessage = interaction.fields.getTextInputValue(accessWelcomeMessageId).trim();
    const welcomeChannelId = selectedChannelId(interaction.fields.getSelectedChannels(accessWelcomeMessageChannelId, false));
    const loggingValue = interaction.fields.getStringSelectValues(accessJoinLeaveLoggingId)[0];
    const loggingMode = toJoinLeaveMode(loggingValue);
    const loggingChannelId = selectedChannelId(interaction.fields.getSelectedChannels(accessJoinLeaveLoggingChannelId, false));

    applyGuildSetupConfig(botConfig, interaction.guildId, {
      accessWelcomeMessage: welcomeMessage,
      accessWelcomeMessageChannelId: welcomeChannelId,
      accessJoinLeaveLogging: loggingMode,
      accessJoinLeaveLoggingChannelId: loggingChannelId
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
  const removeRoleId = selectedSingleRoleId(interaction.fields.getSelectedRoles(accessEmojiRemoveRoleId));
  // If no channel is selected, use the interaction channel as the default scope.
  const selectedEmojiChannelId = selectedChannelId(interaction.fields.getSelectedChannels(accessEmojiChannelId, false));
  const channelId = selectedEmojiChannelId ?? interaction.channelId;

  if (!emojiValue || !roleId) {
    await interaction.editReply({content: "Emoji and role are required."});
    return true;
  }

  if (!channelId) {
    await interaction.editReply({content: "Could not determine which channel to use for the emoji access setup."});
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
      accessEmojiRemoveRoleId: removeRoleId,
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
    accessEmojiRemoveRoleId: removeRoleId,
    accessEmojiChannelId: channelId,
    accessEmojiMessageId: postedMessage.id,
    accessEmojiMessageContent: messageOrIdInput
  });
  await saveBotConfig(botConfig);

  await updateWizardMessages(interaction, session, buildComponents());
  await interaction.deleteReply().catch(() => undefined);
  return true;
}
