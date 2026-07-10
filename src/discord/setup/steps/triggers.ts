import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, TextDisplayBuilder, TextInputStyle, type ButtonInteraction, type MessageActionRowComponentBuilder, type ModalSubmitInteraction} from "discord.js";
import {LabelBuilder, ModalBuilder, TextInputBuilder} from "@discordjs/builders";
import type {BotConfig, GuildConfig} from "../../../config/schema.js";
import {applyGuildSetupConfig, getGuildSetupConfig, saveBotConfig} from "../../../config/store.js";
import {honeyPotChannelMessageId, moderationThreadMessageId, setupButtonIds, triggerMessagesModalId} from "../constants.js";
import {updateWizardMessages} from "../session.js";
import type {SetupSession} from "../types.js";
import {buildSetupCompleteEmbed} from "../ui.js";

export function buildTriggersContainer(phase: string): ContainerBuilder {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Trigger Messages",
          "Configure the messages the bot will post when moderation or honey pot actions trigger."
        ].join("\n")
      )
    );

  if (phase === "triggers") {
    container.addActionRowComponents(
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Set-up").setCustomId(setupButtonIds.setTriggerMessages),
        new ButtonBuilder().setStyle(ButtonStyle.Success).setLabel("Save").setCustomId(setupButtonIds.next),
        new ButtonBuilder().setStyle(ButtonStyle.Danger).setLabel("Cancel").setCustomId(setupButtonIds.cancelTriggers)
      )
    );
  }

  return container;
}

export function buildTriggerMessagesModal(config: GuildConfig): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(triggerMessagesModalId)
    .setTitle("Trigger Messages")
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Message posted in Moderation thread.")
        .setDescription("This is the message automatically posted for the user to see when the moderation thread is opened.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(moderationThreadMessageId)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.moderationThreadMessage)
        )
    );

  if (config.isHoneyPotChannel) {
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel("Honey Pot Channel Message")
        .setDescription("This message will be posted at the top of the honey pot channel. Designed for humans to read.")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(honeyPotChannelMessageId)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(config.honeyPotChannelMessage)
        )
    );
  }

  return modal;
}

export async function handleTriggersButton(interaction: ButtonInteraction, botConfig: BotConfig, guildId: string, phase: string): Promise<boolean> {
  if (interaction.customId !== setupButtonIds.setTriggerMessages) {
    return false;
  }

  if (phase !== "triggers") {
    await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
    return true;
  }

  const config = getGuildSetupConfig(botConfig, guildId);
  await interaction.showModal(buildTriggerMessagesModal(config));
  return true;
}

export async function handleTriggersModal(
  interaction: ModalSubmitInteraction,
  botConfig: BotConfig,
  session: SetupSession,
  buildComponents: () => ContainerBuilder[]
): Promise<boolean> {
  if (interaction.customId !== triggerMessagesModalId) {
    return false;
  }

  if (session.phase !== "triggers") {
    await interaction.reply({content: "Complete the previous setup step first.", flags: MessageFlags.Ephemeral});
    return true;
  }

  await interaction.deferReply({flags: MessageFlags.Ephemeral});

  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({content: "Could not resolve the server."});
    return true;
  }

  const currentConfig = getGuildSetupConfig(botConfig, interaction.guildId);
  const moderationThreadMessageInput = interaction.fields.getTextInputValue(moderationThreadMessageId).trim();
  const moderationThreadMessage = moderationThreadMessageInput.length > 0
    ? moderationThreadMessageInput
    : currentConfig.moderationThreadMessage;

  const honeyPotMessageInput = currentConfig.isHoneyPotChannel
    ? interaction.fields.getTextInputValue(honeyPotChannelMessageId).trim()
    : currentConfig.honeyPotChannelMessage;
  const honeyPotMessage = honeyPotMessageInput.length > 0
    ? honeyPotMessageInput
    : currentConfig.honeyPotChannelMessage;

  applyGuildSetupConfig(botConfig, interaction.guildId, {
    moderationThreadMessage,
    honeyPotChannelMessage: honeyPotMessage
  });
  await saveBotConfig(botConfig);

  const finalConfig = getGuildSetupConfig(botConfig, interaction.guildId);

  if (finalConfig.isHoneyPotChannel && finalConfig.moderationChannelId) {
    const channel = guild.channels.cache.get(finalConfig.moderationChannelId)
      ?? await guild.channels.fetch(finalConfig.moderationChannelId).catch(() => null);

    if (channel?.isTextBased() && "send" in channel) {
      await channel.send(finalConfig.honeyPotChannelMessage).catch(() => undefined);
    }
  }

  session.phase = "done";
  await updateWizardMessages(interaction, session, buildComponents());
  await interaction.editReply({embeds: [buildSetupCompleteEmbed(finalConfig)]});
  return true;
}
