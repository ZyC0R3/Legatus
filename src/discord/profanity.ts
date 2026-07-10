import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ContainerBuilder,
  EmbedBuilder,
  MessageFlags,
  TextDisplayBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type MessageActionRowComponentBuilder,
  type ModalSubmitInteraction
} from "discord.js";
import {
  ChannelSelectMenuBuilder,
  LabelBuilder,
  ModalBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder as ModalTextDisplayBuilder,
  TextInputBuilder
} from "@discordjs/builders";
import {defaultGuildConfig, type BotConfig, type GuildConfig, type ProfanityLoggingLevel} from "../config/schema.js";
import {applyGuildSetupConfig, resolveGuildConfig, saveBotConfig} from "../config/store.js";

const profanityButtonIds = {
  definedTerms: "adb7b87cc9a549b5ebfbcaac63b101d5",
  next: "93b5e4e622dc4027dcf989a5984b275c",
  cancelTerms: "f1f6fd579f2046f9ae4884dccfca1f6e",
  lowRules: "67ea847ee99943a5a2f7be202f8a6355",
  mediumRules: "9d3b13a17412430b8b0320964f5d21a3",
  highRules: "1577ac33b3434aa2a7a631bb4cf96972",
  criticalRules: "a7f3596e3e41492bb72def8af0228889",
  nextRules: "be26b18b1770468f917aa12cf7ca094b",
  cleanup: "profanity-cleanup-button",
  logging: "profanity-logging-button",
  save: "profanity-save-button"
} as const;

const profanityModalIds = {
  definedTerms: "profanity-defined-terms-modal",
  lowRules: "profanity-low-rules-modal",
  mediumRules: "profanity-medium-rules-modal",
  highRules: "profanity-high-rules-modal",
  criticalRules: "profanity-critical-rules-modal",
  cleanup: "profanity-cleanup-modal",
  logging: "profanity-logging-modal"
} as const;

const profanityFieldIds = {
  levelSelect: "5a3af087813846fb9a95b4c9fd02e1a5",
  lowTerms: "92f3a141fa744a0b8ae2f3ec5ab8ee1d",
  mediumTerms: "6d19bdce8b53479cbffa5e4ec5a93e1f",
  highTerms: "8999e5940f664ab8bd5c7cfed0faf6cf",
  criticalTerms: "cd9704e0d5cd400588dff94ecd8e9d64",
  muteLength: "7a04a2c69dad4efca6179977eae71a77",
  kick: "18afcca9efc448c4a4827fcfb03d4346",
  ban: "2716b01097dd4b4aa467c125ae351a1a",
  openThread: "f2a9013f181c4d0d8bb53009061e85b2",
  cleanupActions: "ddbcb3dc680143e8937119d85f0c83e1",
  cleanupMessageToPost: "496c3129dd9746bb88c51b2b1f472b76",
  cleanupAddRole: "780099d086944b0e894f002e7f31dae0",
  cleanupRemoveRole: "2f61290fdbce4b38a2b9c81aa0915c47",
  loggingChannel: "cc55e35025984664a77171b6abd61cab",
  loggingLevel: "54caaae461ec45f48b022ea5a8442e20"
} as const;

const cleanupActionValues = {
  deleteOriginalMessage: "a9793cbf713b4c368681d199fe744d31",
  postMessageInChannel: "8372d1202607451c837408cd265a6ae1",
  addRole: "44dbc4e515a146a6b3a5e864cf335291",
  removeRole: "993ff9e91f6a44168fc528cdfedeb4d1"
} as const;

const loggingValues = {
  none: "29d77d184ff24376a83e1cde1047807f",
  violations: "5f70cc9c25ae43c4a20e3279d4ff9fde",
  violationsAndModerations: "02ff5e0df43d49bc9e98e4582ef341df",
  all: "18cef6696ebc4565b160510fdc8557f6"
} as const;

type ProfanitySession = {
  messageId: string;
  termsCompleted: boolean;
};

type ProfanityLevel = "low" | "medium" | "high" | "critical";

const profanitySessions = new Map<string, ProfanitySession>();

function profanitySessionKey(guildId: string, userId: string): string {
  return `${guildId}:${userId}`;
}

function capitalize(value: string): string {
  return value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

function parseTermsList(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(",")
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
}

function formatTermsForModal(value: string): string {
  return parseTermsList(value).join(", ");
}

function formatTermsForSave(value: string): string {
  return parseTermsList(value).join(" ,");
}

function parseActiveLevels(values: readonly string[]): ProfanityLevel[] {
  return values.filter((value): value is ProfanityLevel =>
    value === "low" || value === "medium" || value === "high" || value === "critical"
  );
}

function hasConfiguredTerms(config: GuildConfig): boolean {
  return config.profanityTermsConfigured
    || config.profanityActiveLevels.length > 0
    || config.profanityLowTerms !== defaultGuildConfig.profanityLowTerms
    || config.profanityMediumTerms !== defaultGuildConfig.profanityMediumTerms
    || config.profanityHighTerms !== defaultGuildConfig.profanityHighTerms
    || config.profanityCriticalTerms !== defaultGuildConfig.profanityCriticalTerms;
}

function parseBooleanSelection(values: readonly string[]): boolean | null {
  const selected = values[0];
  if (selected === "yes") {
    return true;
  }
  if (selected === "no") {
    return false;
  }
  return null;
}

function parseDurationSelection(values: readonly string[]): number | null {
  const selected = values[0];
  if (!selected) {
    return null;
  }

  const parsed = Number(selected);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function hasConfiguredRule(config: GuildConfig["profanityRules"][ProfanityLevel]): boolean {
  return config.muteLengthMs !== null || config.kick !== null || config.ban !== null || config.openThread !== null;
}

function loggingValueForLevel(level: ProfanityLoggingLevel): string {
  if (level === "none") {
    return loggingValues.none;
  }
  if (level === "violations") {
    return loggingValues.violations;
  }
  if (level === "violations-and-moderations") {
    return loggingValues.violationsAndModerations;
  }
  return loggingValues.all;
}

function loggingLevelFromValue(value: string | undefined): ProfanityLoggingLevel {
  if (value === loggingValues.violations) {
    return "violations";
  }
  if (value === loggingValues.violationsAndModerations) {
    return "violations-and-moderations";
  }
  if (value === loggingValues.all) {
    return "all";
  }
  return "none";
}

function selectedRoleId(values: {values(): Iterable<{id: string} | null>} | null): string | null {
  for (const value of values?.values() ?? []) {
    if (value?.id) {
      return value.id;
    }
  }
  return null;
}

function selectedChannelId(values: {values(): Iterable<{id: string} | null>} | null): string | null {
  for (const value of values?.values() ?? []) {
    if (value?.id) {
      return value.id;
    }
  }
  return null;
}

function buildProfanitySummaryEmbed(config: GuildConfig): EmbedBuilder {
  const activeLevels = config.profanityActiveLevels.length > 0
    ? config.profanityActiveLevels.map((level) => capitalize(level)).join(", ")
    : "None";

  const rulesConfigured = (["low", "medium", "high", "critical"] as const)
    .filter((level) => hasConfiguredRule(config.profanityRules[level]))
    .map((level) => capitalize(level));

  const cleanupActions: string[] = [];
  if (config.profanityCleanup.deleteOriginalMessage) {
    cleanupActions.push("Delete original message");
  }
  if (config.profanityCleanup.postMessageInChannel) {
    cleanupActions.push("Post message in channel");
  }
  if (config.profanityCleanup.addRoleId) {
    cleanupActions.push("Add role");
  }
  if (config.profanityCleanup.removeRoleId) {
    cleanupActions.push("Remove role");
  }

  return new EmbedBuilder()
    .setTitle("Profanity Setup Saved")
    .setDescription("Profanity configuration has been saved.")
    .addFields(
      {
        name: "Defined Terms",
        value: hasConfiguredTerms(config) ? "Saved" : "Not configured",
        inline: false
      },
      {
        name: "Active Filter Levels",
        value: activeLevels,
        inline: false
      },
      {
        name: "Rules Configured",
        value: rulesConfigured.length > 0 ? rulesConfigured.join(", ") : "None",
        inline: false
      },
      {
        name: "Cleanup Actions",
        value: cleanupActions.length > 0 ? cleanupActions.join(", ") : "None",
        inline: false
      },
      {
        name: "Logging",
        value: config.profanityLogging.level === "none"
          ? "None"
          : `${capitalize(config.profanityLogging.level)} in ${config.profanityLogging.channelId ? `<#${config.profanityLogging.channelId}>` : "No channel selected"}`,
        inline: false
      }
    );
}

function buildProfanityHeaderContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [
          "Profanity and Banned words",
          "A list of banned words and phrases can be defined here."
        ].join("\n")
      )
    );
}

function buildTermsOnlyComponents(): ContainerBuilder[] {
  return [
    buildProfanityHeaderContainer()
      .addActionRowComponents(
        new ActionRowBuilder<MessageActionRowComponentBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Success)
              .setLabel("Defined Terms")
              .setCustomId(profanityButtonIds.definedTerms),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel("Next")
              .setCustomId(profanityButtonIds.next),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel("Cancel")
              .setCustomId(profanityButtonIds.cancelTerms)
          )
      ),
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Profanity and Banned words - Rules")
      ),
    buildCleanupLoggingContainer(false)
  ];
}

function buildRulesComponents(): ContainerBuilder[] {
  return [
    buildProfanityHeaderContainer(),
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Profanity and Banned words - Rules")
      )
      .addActionRowComponents(
        new ActionRowBuilder<MessageActionRowComponentBuilder>()
          .addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Success)
              .setLabel("Low - Rules")
              .setCustomId(profanityButtonIds.lowRules),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel("Medium - Rules")
              .setCustomId(profanityButtonIds.mediumRules),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setLabel("High - Rules")
              .setCustomId(profanityButtonIds.highRules),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Danger)
              .setLabel("Critical - Rules")
              .setCustomId(profanityButtonIds.criticalRules),
            new ButtonBuilder()
              .setStyle(ButtonStyle.Success)
              .setLabel("Next")
              .setCustomId(profanityButtonIds.nextRules)
          )
      ),
    buildCleanupLoggingContainer(false)
  ];
}

function buildCleanupLoggingContainer(enabled: boolean): ContainerBuilder {
  const container = new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Clean up and Logging")
    );

  if (!enabled) {
    return container;
  }

  return container.addActionRowComponents(
    new ActionRowBuilder<MessageActionRowComponentBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel("Clean up")
          .setCustomId(profanityButtonIds.cleanup),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel("Logging")
          .setCustomId(profanityButtonIds.logging),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Success)
          .setLabel("Save")
          .setCustomId(profanityButtonIds.save)
      )
  );
}

function buildCleanupLoggingComponents(): ContainerBuilder[] {
  return [
    buildProfanityHeaderContainer(),
    new ContainerBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("Profanity and Banned words - Rules")
      ),
    buildCleanupLoggingContainer(true)
  ];
}

function buildDefinedTermsModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setTitle("Profanity, Banned words")
    .setCustomId(profanityModalIds.definedTerms)
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Select the Level of filter to activate")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(profanityFieldIds.levelSelect)
            .setMaxValues(4)
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel("Low").setValue("low").setDefault(config.profanityActiveLevels.includes("low")),
              new StringSelectMenuOptionBuilder().setLabel("Medium").setValue("medium").setDefault(config.profanityActiveLevels.includes("medium")),
              new StringSelectMenuOptionBuilder().setLabel("High").setValue("high").setDefault(config.profanityActiveLevels.includes("high")),
              new StringSelectMenuOptionBuilder().setLabel("Critical").setValue("critical").setDefault(config.profanityActiveLevels.includes("critical"))
            )
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Low")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(profanityFieldIds.lowTerms)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(formatTermsForModal(config.profanityLowTerms))
            .setRequired(false)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Medium")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(profanityFieldIds.mediumTerms)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(formatTermsForModal(config.profanityMediumTerms))
            .setRequired(false)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("High")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(profanityFieldIds.highTerms)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(formatTermsForModal(config.profanityHighTerms))
            .setRequired(false)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Critical")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(profanityFieldIds.criticalTerms)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(formatTermsForModal(config.profanityCriticalTerms))
            .setRequired(false)
        )
    );
}

function buildRulesModal(level: ProfanityLevel, modalId: string, ruleConfig: GuildConfig["profanityRules"][ProfanityLevel]): ModalBuilder {
  const levelLabel = capitalize(level);

  return new ModalBuilder()
    .setTitle("Profanity, Banned words - Rules")
    .setCustomId(modalId)
    .addTextDisplayComponents(
      new ModalTextDisplayBuilder()
        .setContent(`Define the moderation actions to take on a ${levelLabel} infraction`)
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Mute Length")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(profanityFieldIds.muteLength)
            .setRequired(false)
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel("60 Secs").setValue(String(60 * 1000)).setDefault(ruleConfig.muteLengthMs === 60 * 1000),
              new StringSelectMenuOptionBuilder().setLabel("5 Mins").setValue(String(5 * 60 * 1000)).setDefault(ruleConfig.muteLengthMs === 5 * 60 * 1000),
              new StringSelectMenuOptionBuilder().setLabel("10 Mins").setValue(String(10 * 60 * 1000)).setDefault(ruleConfig.muteLengthMs === 10 * 60 * 1000),
              new StringSelectMenuOptionBuilder().setLabel("1 Hour").setValue(String(60 * 60 * 1000)).setDefault(ruleConfig.muteLengthMs === 60 * 60 * 1000),
              new StringSelectMenuOptionBuilder().setLabel("1 Day").setValue(String(24 * 60 * 60 * 1000)).setDefault(ruleConfig.muteLengthMs === 24 * 60 * 60 * 1000),
              new StringSelectMenuOptionBuilder().setLabel("1 Week").setValue(String(7 * 24 * 60 * 60 * 1000)).setDefault(ruleConfig.muteLengthMs === 7 * 24 * 60 * 60 * 1000)
            )
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Kick?")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(profanityFieldIds.kick)
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel("Yes").setValue("yes").setDefault(ruleConfig.kick === true),
              new StringSelectMenuOptionBuilder().setLabel("No").setValue("no").setDefault(ruleConfig.kick === false)
            )
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Ban?")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(profanityFieldIds.ban)
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel("Yes").setValue("yes").setDefault(ruleConfig.ban === true),
              new StringSelectMenuOptionBuilder().setLabel("No").setValue("no").setDefault(ruleConfig.ban === false)
            )
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Open Moderation Thread")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(profanityFieldIds.openThread)
            .addOptions(
              new StringSelectMenuOptionBuilder().setLabel("Yes").setValue("yes").setDefault(ruleConfig.openThread === true),
              new StringSelectMenuOptionBuilder().setLabel("No").setValue("no").setDefault(ruleConfig.openThread === false)
            )
        )
    );
}

function buildCleanupModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setTitle("Clean up Conditions")
    .setCustomId(profanityModalIds.cleanup)
    .addTextDisplayComponents(
      new ModalTextDisplayBuilder()
        .setContent("Once a message is detected by the filter and moderation system, what action would you like to take place.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Actions")
        .setDescription("These are separate rules to moderation rules and are generic for overall actions.")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(profanityFieldIds.cleanupActions)
            .setMaxValues(4)
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("Delete original message")
                .setValue(cleanupActionValues.deleteOriginalMessage)
                .setDefault(config.profanityCleanup.deleteOriginalMessage),
              new StringSelectMenuOptionBuilder()
                .setLabel("Post message in channel")
                .setValue(cleanupActionValues.postMessageInChannel)
                .setDefault(config.profanityCleanup.postMessageInChannel),
              new StringSelectMenuOptionBuilder()
                .setLabel("Add Role")
                .setValue(cleanupActionValues.addRole)
                .setDefault(Boolean(config.profanityCleanup.addRoleId)),
              new StringSelectMenuOptionBuilder()
                .setLabel("Remove Role")
                .setValue(cleanupActionValues.removeRole)
                .setDefault(Boolean(config.profanityCleanup.removeRoleId))
            )
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Message to post (If selected)")
        .setDescription("EG: Your message was deleted as it violated our rule")
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId(profanityFieldIds.cleanupMessageToPost)
            .setStyle(TextInputStyle.Short)
            .setValue(config.profanityCleanup.messageToPost)
            .setRequired(false)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Add Role (If selected)")
        .setDescription("You can choose to add a role to a user if they trigger moderation.")
        .setRoleSelectMenuComponent(
          new RoleSelectMenuBuilder()
            .setCustomId(profanityFieldIds.cleanupAddRole)
            .setDefaultRoles(...(config.profanityCleanup.addRoleId ? [config.profanityCleanup.addRoleId] : []))
            .setRequired(false)
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Remove Role (If selected)")
        .setDescription("You can choose to remove a role from a user if they trigger moderation.")
        .setRoleSelectMenuComponent(
          new RoleSelectMenuBuilder()
            .setCustomId(profanityFieldIds.cleanupRemoveRole)
            .setDefaultRoles(...(config.profanityCleanup.removeRoleId ? [config.profanityCleanup.removeRoleId] : []))
            .setRequired(false)
        )
    );
}

function buildLoggingModal(config: GuildConfig): ModalBuilder {
  return new ModalBuilder()
    .setTitle("Logging")
    .setCustomId(profanityModalIds.logging)
    .addTextDisplayComponents(
      new ModalTextDisplayBuilder()
        .setContent("If you want to define a logging channel for profanity and moderation triggers.")
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Channel Select")
        .setChannelSelectMenuComponent(
          new ChannelSelectMenuBuilder()
            .setCustomId(profanityFieldIds.loggingChannel)
            .setChannelTypes([ChannelType.GuildText])
            .setRequired(false)
            .setDefaultChannels(...(config.profanityLogging.channelId ? [config.profanityLogging.channelId] : []))
        )
    )
    .addLabelComponents(
      new LabelBuilder()
        .setLabel("Level of Logging")
        .setStringSelectMenuComponent(
          new StringSelectMenuBuilder()
            .setCustomId(profanityFieldIds.loggingLevel)
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel("None")
                .setValue(loggingValues.none)
                .setDescription("Do not log anything.")
                .setDefault(loggingValueForLevel(config.profanityLogging.level) === loggingValues.none),
              new StringSelectMenuOptionBuilder()
                .setLabel("Violations")
                .setValue(loggingValues.violations)
                .setDescription("Only log violations, not moderation actions")
                .setDefault(loggingValueForLevel(config.profanityLogging.level) === loggingValues.violations),
              new StringSelectMenuOptionBuilder()
                .setLabel("Violations and Moderations")
                .setValue(loggingValues.violationsAndModerations)
                .setDescription("Log violations and moderation actions.")
                .setDefault(loggingValueForLevel(config.profanityLogging.level) === loggingValues.violationsAndModerations),
              new StringSelectMenuOptionBuilder()
                .setLabel("All")
                .setValue(loggingValues.all)
                .setDescription("Log everything, violations, moderation actions, channel creations")
                .setDefault(loggingValueForLevel(config.profanityLogging.level) === loggingValues.all)
            )
        )
    );
}

function isProfanityButton(customId: string): boolean {
  return Object.values(profanityButtonIds).includes(customId as (typeof profanityButtonIds)[keyof typeof profanityButtonIds]);
}

function isProfanityModal(customId: string): boolean {
  return Object.values(profanityModalIds).includes(customId as (typeof profanityModalIds)[keyof typeof profanityModalIds]);
}

export async function postProfanityPanel(interaction: ChatInputCommandInteraction, botConfig?: BotConfig): Promise<void> {
  await interaction.reply({
    components: buildTermsOnlyComponents(),
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });

  if (interaction.guildId) {
    const config = botConfig ? resolveGuildConfig(botConfig, interaction.guildId) : null;
    const panelMessage = await interaction.fetchReply();
    profanitySessions.set(profanitySessionKey(interaction.guildId, interaction.user.id), {
      messageId: panelMessage.id,
      termsCompleted: config ? hasConfiguredTerms(config) : false
    });
  }
}

export async function handleProfanityButton(interaction: ButtonInteraction, botConfig: BotConfig): Promise<boolean> {
  if (!isProfanityButton(interaction.customId)) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({content: "This panel can only be used in a server.", flags: MessageFlags.Ephemeral});
    return true;
  }

  const config = resolveGuildConfig(botConfig, interaction.guildId);
  const key = profanitySessionKey(interaction.guildId, interaction.user.id);
  let session = profanitySessions.get(key);
  const configured = hasConfiguredTerms(config);

  if (!session || session.messageId !== interaction.message.id) {
    session = {
      messageId: interaction.message.id,
      termsCompleted: configured
    };
    profanitySessions.set(key, session);
  } else if (configured && !session.termsCompleted) {
    session.termsCompleted = true;
  }

  if (interaction.customId === profanityButtonIds.definedTerms) {
    await interaction.showModal(buildDefinedTermsModal(config));
    return true;
  }

  if (interaction.customId === profanityButtonIds.cancelTerms) {
    await interaction.deferUpdate();
    await interaction.deleteReply().catch(() => undefined);
    profanitySessions.delete(key);
    return true;
  }

  if (interaction.customId === profanityButtonIds.next) {
    if (!session || !session.termsCompleted || session.messageId !== interaction.message.id) {
      await interaction.reply({
        content: "Complete Defined Terms first.",
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    await interaction.update({
      components: buildRulesComponents(),
      flags: MessageFlags.IsComponentsV2
    });
    return true;
  }

  if (!session || !session.termsCompleted || session.messageId !== interaction.message.id) {
    await interaction.reply({
      content: "Complete Defined Terms first.",
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.customId === profanityButtonIds.lowRules) {
    await interaction.showModal(buildRulesModal("low", profanityModalIds.lowRules, config.profanityRules.low));
    return true;
  }

  if (interaction.customId === profanityButtonIds.mediumRules) {
    await interaction.showModal(buildRulesModal("medium", profanityModalIds.mediumRules, config.profanityRules.medium));
    return true;
  }

  if (interaction.customId === profanityButtonIds.highRules) {
    await interaction.showModal(buildRulesModal("high", profanityModalIds.highRules, config.profanityRules.high));
    return true;
  }

  if (interaction.customId === profanityButtonIds.criticalRules) {
    await interaction.showModal(buildRulesModal("critical", profanityModalIds.criticalRules, config.profanityRules.critical));
    return true;
  }

  if (interaction.customId === profanityButtonIds.nextRules) {
    await interaction.update({
      components: buildCleanupLoggingComponents(),
      flags: MessageFlags.IsComponentsV2
    });
    return true;
  }

  if (interaction.customId === profanityButtonIds.cleanup) {
    await interaction.showModal(buildCleanupModal(config));
    return true;
  }

  if (interaction.customId === profanityButtonIds.logging) {
    await interaction.showModal(buildLoggingModal(config));
    return true;
  }

  if (interaction.customId === profanityButtonIds.save) {
    const finalConfig = resolveGuildConfig(botConfig, interaction.guildId);
    await interaction.deferUpdate();
    await interaction.deleteReply().catch(() => undefined);
    await interaction.followUp({
      embeds: [buildProfanitySummaryEmbed(finalConfig)],
      flags: MessageFlags.Ephemeral
    }).catch(() => undefined);
    return true;
  }

  await interaction.reply({
    content: "This profanity panel action is not wired yet.",
    flags: MessageFlags.Ephemeral
  });
  return true;
}

export async function handleProfanityModal(interaction: ModalSubmitInteraction, botConfig: BotConfig): Promise<boolean> {
  if (!isProfanityModal(interaction.customId)) {
    return false;
  }

  if (!interaction.inGuild()) {
    await interaction.reply({
      content: "This panel can only be used in a server.",
      flags: MessageFlags.Ephemeral
    });
    return true;
  }

  if (interaction.customId === profanityModalIds.definedTerms) {
    const selectedLevels = parseActiveLevels(interaction.fields.getStringSelectValues(profanityFieldIds.levelSelect));

    applyGuildSetupConfig(botConfig, interaction.guildId, {
      profanityLowTerms: formatTermsForSave(interaction.fields.getTextInputValue(profanityFieldIds.lowTerms)),
      profanityMediumTerms: formatTermsForSave(interaction.fields.getTextInputValue(profanityFieldIds.mediumTerms)),
      profanityHighTerms: formatTermsForSave(interaction.fields.getTextInputValue(profanityFieldIds.highTerms)),
      profanityCriticalTerms: formatTermsForSave(interaction.fields.getTextInputValue(profanityFieldIds.criticalTerms)),
      profanityActiveLevels: selectedLevels,
      profanityTermsConfigured: true
    });
    await saveBotConfig(botConfig);

    const session = profanitySessions.get(profanitySessionKey(interaction.guildId, interaction.user.id));
    if (session) {
      session.termsCompleted = true;
    }

    await interaction.deferUpdate();
    return true;
  }

  const modalToLevel: Partial<Record<(typeof profanityModalIds)[keyof typeof profanityModalIds], ProfanityLevel>> = {
    [profanityModalIds.lowRules]: "low",
    [profanityModalIds.mediumRules]: "medium",
    [profanityModalIds.highRules]: "high",
    [profanityModalIds.criticalRules]: "critical"
  };

  const level = modalToLevel[interaction.customId as (typeof profanityModalIds)[keyof typeof profanityModalIds]];
  if (level) {
    const config = resolveGuildConfig(botConfig, interaction.guildId);
    applyGuildSetupConfig(botConfig, interaction.guildId, {
      profanityRules: {
        ...config.profanityRules,
        [level]: {
          muteLengthMs: parseDurationSelection(interaction.fields.getStringSelectValues(profanityFieldIds.muteLength)),
          kick: parseBooleanSelection(interaction.fields.getStringSelectValues(profanityFieldIds.kick)),
          ban: parseBooleanSelection(interaction.fields.getStringSelectValues(profanityFieldIds.ban)),
          openThread: parseBooleanSelection(interaction.fields.getStringSelectValues(profanityFieldIds.openThread))
        }
      }
    });
    await saveBotConfig(botConfig);

    await interaction.deferUpdate();
    return true;
  }

  if (interaction.customId === profanityModalIds.cleanup) {
    const selectedActions = interaction.fields.getStringSelectValues(profanityFieldIds.cleanupActions);

    applyGuildSetupConfig(botConfig, interaction.guildId, {
      profanityCleanup: {
        deleteOriginalMessage: selectedActions.includes(cleanupActionValues.deleteOriginalMessage),
        postMessageInChannel: selectedActions.includes(cleanupActionValues.postMessageInChannel),
        messageToPost: interaction.fields.getTextInputValue(profanityFieldIds.cleanupMessageToPost).trim(),
        addRoleId: selectedRoleId(interaction.fields.getSelectedRoles(profanityFieldIds.cleanupAddRole)),
        removeRoleId: selectedRoleId(interaction.fields.getSelectedRoles(profanityFieldIds.cleanupRemoveRole))
      }
    });
    await saveBotConfig(botConfig);

    await interaction.deferUpdate();
    return true;
  }

  if (interaction.customId === profanityModalIds.logging) {
    const selectedLevel = interaction.fields.getStringSelectValues(profanityFieldIds.loggingLevel)[0];
    const selectedChannel = selectedChannelId(interaction.fields.getSelectedChannels(profanityFieldIds.loggingChannel, false));

    applyGuildSetupConfig(botConfig, interaction.guildId, {
      profanityLogging: {
        channelId: selectedChannel,
        level: loggingLevelFromValue(selectedLevel)
      }
    });
    await saveBotConfig(botConfig);

    await interaction.deferUpdate();
    return true;
  }

  await interaction.reply({
    content: "Saved for now. Profanity actions will be implemented next.",
    flags: MessageFlags.Ephemeral
  });
  return true;
}
