import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, ContainerBuilder, MessageFlags, TextDisplayBuilder, TextInputStyle, type ButtonInteraction, type MessageActionRowComponentBuilder, type ModalSubmitInteraction} from "discord.js";
import {ChannelSelectMenuBuilder, LabelBuilder, ModalBuilder, TextDisplayBuilder as ModalTextDisplayBuilder, TextInputBuilder} from "@discordjs/builders";
import type {BotConfig, GuildConfig} from "../../../config/schema.js";
import {applyGuildSetupConfig, saveBotConfig} from "../../../config/store.js";
import {channelNameInputId, channelSelectId, createChannelModalId, existingChannelModalId, honeyPotNoValue, honeyPotSelectId, setupButtonIds} from "../constants.js";
import {buildHoneyPotSelect, buildModerationChannelOverwrites, isHoneyPotSelected, selectedChannelId} from "../helpers.js";
import {updateWizardMessages} from "../session.js";
import type {SetupSession} from "../types.js";
import {getGuildSetupConfig} from "../../../config/store.js";

export function buildChannelsContainer(phase: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Channel Set-up",
          "Choose whether to use an existing moderation channel or create a new one."
        ].join("\n")
      )
    );

  if (phase === "channels") {
    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Create New").setCustomId(setupButtonIds.createNewChannel),
        new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Use Existing").setCustomId(setupButtonIds.useExistingChannel),
        new ButtonBuilder().setStyle(ButtonStyle.Primary).setLabel("Next").setCustomId(setupButtonIds.next),
        new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel("Cancel").setCustomId(setupButtonIds.cancelChannels)
      )
    );
  }

  return container;
}

export function buildExistingChannelModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(existingChannelModalId)
    .setTitle("Channel Set-up")
    .addTextDisplayComponents(
      new ModalTextDisplayBuilder().setContent("All moderation actions will follow this same logic. \n\n1:Once a moderation action is triggered, the targeted user will be timed-out for 1 hour.\n\n2:A thread will be opened in the moderation channel with the target user added, along with moderators.\n\n3: A copy of the targeted or triggering message will be shown, with a number of buttons for quick moderation actions.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Channel Selection")
        .setDescription("Pick a channel to act as the moderation channel")
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId(channelSelectId)
            .setMinValues(1)
            .setMaxValues(1)
            .setChannelTypes([ChannelType.GuildText])
        ),
      new LabelBuilder()
        .setLabel("Do you want this to act as a honey pot?")
        .setDescription("A honey pot channel will automatically time out any user who posts in the channel.")
        .setStringSelectMenuComponent(buildHoneyPotSelect())
    );
}

export function buildCreateChannelModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(createChannelModalId)
    .setTitle("Channel Set-up")
    .addTextDisplayComponents(
      new ModalTextDisplayBuilder().setContent("All moderation actions will follow this same logic. \n\n1:Once a moderation action is triggered, the targeted user will be timed-out for 1 hour.\n\n2:A thread will be opened in the moderation channel with the target user added, along with moderators.\n\n3: A copy of the targeted or triggering message will be shown, with a number of buttons for quick moderation actions.\n\nIf no channel is selected, the channel will be made at the top of the server.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Category Selection")
        .setDescription("Pick a category to create the moderation channel in.")
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId(channelSelectId)
            .setMinValues(1)
            .setMaxValues(1)
            .setChannelTypes([ChannelType.GuildCategory])
        ),
      new LabelBuilder()
        .setLabel("Do you want this to act as a honey pot?")
        .setDescription("A honey pot channel will automatically time out any user who posts in the channel.")
        .setStringSelectMenuComponent(buildHoneyPotSelect()),
      new LabelBuilder()
        .setLabel("Channel Name")
        .setDescription("Enter the name for the channel to create.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(channelNameInputId)
            .setStyle(TextInputStyle.Short)
            .setValue("Fovea")
            .setRequired(true)
        )
    );
}

export async function handleChannelsButton(interaction: ButtonInteraction, phase: string): Promise<boolean> {
  if (interaction.customId !== setupButtonIds.useExistingChannel && interaction.customId !== setupButtonIds.createNewChannel) {
    return false;
  }

  if (phase !== "channels") {
    await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
    return true;
  }

  if (interaction.customId === setupButtonIds.useExistingChannel) {
    await interaction.showModal(buildExistingChannelModal());
    return true;
  }

  await interaction.showModal(buildCreateChannelModal());
  return true;
}

export async function handleChannelsModal(
  interaction: ModalSubmitInteraction,
  botConfig: BotConfig,
  session: SetupSession,
  buildComponents: () => ContainerBuilder[]
): Promise<boolean> {
  if (interaction.customId !== existingChannelModalId && interaction.customId !== createChannelModalId) {
    return false;
  }

  if (session.phase !== "channels") {
    await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
    return true;
  }

  await interaction.deferReply({flags: MessageFlags.Ephemeral});

  if (interaction.customId === existingChannelModalId) {
    applyGuildSetupConfig(botConfig, interaction.guildId, {
      moderationChannelId: selectedChannelId(interaction.fields.getSelectedChannels(channelSelectId, false)),
      moderationCategoryId: null,
      moderationChannelMode: "existing",
      isHoneyPotChannel: isHoneyPotSelected(interaction.fields.getStringSelectValues(honeyPotSelectId)[0] ?? honeyPotNoValue)
    });
    await saveBotConfig(botConfig);

    session.phase = "moderation";
    await updateWizardMessages(interaction, session, buildComponents());
    await interaction.deleteReply().catch(() => undefined);
    return true;
  }

  const channelName = interaction.fields.getTextInputValue(channelNameInputId).trim();
  const selectedCategoryId = selectedChannelId(interaction.fields.getSelectedChannels(channelSelectId, false));

  if (!channelName) {
    await interaction.editReply({content: "Channel name is required."});
    return true;
  }

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({content: "Could not resolve the server while creating the channel."});
    return true;
  }

  const isHoneyPotChannel = isHoneyPotSelected(interaction.fields.getStringSelectValues(honeyPotSelectId)[0] ?? honeyPotNoValue);
  const config = {
    ...getGuildSetupConfig(botConfig, interaction.guildId),
    moderationCategoryId: selectedCategoryId,
    moderationChannelMode: "new" as const,
    isHoneyPotChannel
  };

  const createdChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: selectedCategoryId ?? null,
    permissionOverwrites: buildModerationChannelOverwrites(config, guild.roles.everyone.id),
    reason: "Legatus setup wizard: create moderation channel"
  }).catch(() => null);

  if (!createdChannel) {
    await interaction.editReply({content: "I could not create the channel. Check my channel and role permissions, then try again."});
    return true;
  }

  session.createdChannelIds.push(createdChannel.id);

  applyGuildSetupConfig(botConfig, interaction.guildId, {
    moderationChannelId: createdChannel.id,
    moderationCategoryId: selectedCategoryId,
    moderationChannelMode: "new",
    isHoneyPotChannel
  });
  await saveBotConfig(botConfig);

  session.phase = "moderation";
  await updateWizardMessages(interaction, session, buildComponents());
  await interaction.deleteReply().catch(() => undefined);
  return true;
}
