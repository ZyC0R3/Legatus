/**
 * Module: handlers
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {type Client, Events, type Interaction, MessageFlags, type Message} from "discord.js";
import {slashCommandMap} from "../commands/index.js";
import {type BotConfig, type GuildConfig} from "../config/schema.js";
import {resolveGuildConfig} from "../config/store.js";
import {canUseCommands, shouldBypassProfanityFilter, shouldIgnoreMember, shouldRespondToMessages} from "../permissions.js";
import {handleAccessEmojiReaction, handleAccessMemberJoin, handleAccessMemberLeave, handleAccessPasswordMessage} from "./access-control.js";
import {handlePendingModerationPromptResponse, handleHoneyPotAction, handleHoneyPotMessage, handleModerationMention} from "./honey-pot.js";
import {logViolationMessage} from "./logging.js";
import {isBotOwnedModerationThreadMessage} from "./moderation-thread.js";
import {applyProfanityActions} from "./profanity-enforcement.js";
import {ModerationEngineManager} from "../moderation/manager.js";
import {buildRulePreview} from "../moderation/types.js";
import {handleProfanityButton, handleProfanityModal} from "./profanity.js";
import {registerApplicationCommands} from "./register-commands.js";
import {handleSetupButton, handleSetupModal} from "./setup.js";
import {handleAntiSpamButton, handleAntiSpamMessage, handleAntiSpamModal} from "./antispam.js";

// messageMatchesTrigger defines this module's public behavior or core flow.
function messageMatchesTrigger(message: Message, config: GuildConfig): boolean {
  const content = message.content.toLowerCase();
  return config.messageTriggers.some((trigger) => content.includes(trigger.toLowerCase()));
}

// hasMassMention defines this module's public behavior or core flow.
function hasMassMention(message: Message): boolean {
  if (message.mentions.everyone) {
    return true;
  }

  return /(^|\s)@(here|everyone)\b/i.test(message.content);
}

// shouldIgnoreMessageAuthor defines this module's public behavior or core flow.
async function shouldIgnoreMessageAuthor(message: Message, config: GuildConfig): Promise<boolean> {
  if (!message.guild || !message.member) {
    return false;
  }

  if (shouldIgnoreMember(message.member, config)) {
    return true;
  }

  const freshMember = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!freshMember) {
    return false;
  }

  return shouldIgnoreMember(freshMember, config);
}

// shouldSkipProfanityForAuthor defines this module's public behavior or core flow.
async function shouldSkipProfanityForAuthor(message: Message, config: GuildConfig): Promise<boolean> {
  if (!message.guild || !message.member) {
    return false;
  }

  if (shouldBypassProfanityFilter(message.member, config)) {
    return true;
  }

  const freshMember = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!freshMember) {
    return false;
  }

  return shouldBypassProfanityFilter(freshMember, config);
}

// handleSlashCommand defines this module's public behavior or core flow.
async function handleSlashCommand(interaction: Interaction, config: GuildConfig, botConfig: BotConfig): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = slashCommandMap.get(interaction.commandName);

  if (!command) {
    await interaction.reply({content: "This command is not registered yet.", flags: MessageFlags.Ephemeral});
    return;
  }

  if (!interaction.guild) {
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (!member || shouldIgnoreMember(member, config)) {
    await interaction.reply({content: "You are not allowed to use Legatus here.", flags: MessageFlags.Ephemeral});
    return;
  }

  const bypassCommandPermission = interaction.commandName === "scanmembers";

  if (!bypassCommandPermission && !canUseCommands(member, config)) {
    await interaction.reply({content: "You do not have permission to use this command.", flags: MessageFlags.Ephemeral});
    return;
  }

  try {
    await command.execute(interaction, botConfig);
  } catch (error) {
    console.error(`Failed to execute /${interaction.commandName}.`, error);

    const failureMessage = "An unexpected error occurred while running that command.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({content: failureMessage, flags: MessageFlags.Ephemeral}).catch(() => undefined);
      return;
    }

    await interaction.reply({content: failureMessage, flags: MessageFlags.Ephemeral}).catch(() => undefined);
  }
}

// handleMessage defines this module's public behavior or core flow.
async function handleMessage(message: Message, client: Client, config: GuildConfig, moderationEngineManager: ModerationEngineManager): Promise<void> {
  if (!message.inGuild() || !message.member || message.author.bot) {
    return;
  }

  if (isBotOwnedModerationThreadMessage(message, config, client.user?.id ?? null)) {
    return;
  }

  const passwordHandled = await handleAccessPasswordMessage(message, config);
  if (passwordHandled) {
    return;
  }

  if (await shouldIgnoreMessageAuthor(message, config)) {
    return;
  }

  const promptHandled = await handlePendingModerationPromptResponse(message, config);
  if (promptHandled) {
    return;
  }

  const honeyPotHandled = await handleHoneyPotMessage(message, config);
  if (honeyPotHandled) {
    return;
  }

  const antiSpamHandled = await handleAntiSpamMessage(message, config);
  if (antiSpamHandled) {
    return;
  }

  if (!(await shouldSkipProfanityForAuthor(message, config))) {
    const moderationResult = moderationEngineManager.evaluate(message.guildId, config, message.content);
    if (moderationResult.matched && moderationResult.severity) {
      const fallbackRulePreview = buildRulePreview(config.profanityRules[moderationResult.severity]);
      const actionSummary = await applyProfanityActions(message, config, moderationResult);
      await logViolationMessage(
        message,
        config,
        moderationResult.matchedText,
        moderationResult.severity,
        actionSummary || fallbackRulePreview
      );
      return;
    }
  }

  if (!hasMassMention(message)) {
    const wasMentioned = message.mentions.has(client.user?.id ?? "");
    if (wasMentioned) {
      const moderationHandled = await handleModerationMention(message, config, client.user?.id ?? null);
      if (moderationHandled) {
        return;
      }
    }

    if (messageMatchesTrigger(message, config) && shouldRespondToMessages(message.member, config)) {
      await message.reply("Legatus heard that trigger. The bot core is ready.");
    }
  }
}

// bindDiscordHandlers defines this module's public behavior or core flow.
export function bindDiscordHandlers(client: Client, botConfig: BotConfig): void {
  const moderationEngineManager = new ModerationEngineManager();
  moderationEngineManager.warm(botConfig);

  client.once(Events.ClientReady, async () => {
    const readyUser = client.user?.tag ?? "Legatus";
    console.log(`Logged in as ${readyUser}`);
    await registerApplicationCommands();
    console.log("Slash commands registered.");
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isButton()) {
        const guildConfig = interaction.inGuild() ? resolveGuildConfig(botConfig, interaction.guildId) : botConfig.global;
        const antiSpamHandled = await handleAntiSpamButton(interaction, botConfig);
        if (antiSpamHandled) {
          return;
        }

        const honeyPotHandled = await handleHoneyPotAction(interaction, guildConfig);
        if (honeyPotHandled) {
          return;
        }

        const profanityHandled = await handleProfanityButton(interaction, botConfig);
        if (profanityHandled) {
          return;
        }

        const handled = await handleSetupButton(interaction, botConfig);
        if (handled) {
          return;
        }
      }

      if (interaction.isModalSubmit()) {
        const antiSpamHandled = await handleAntiSpamModal(interaction, botConfig);
        if (antiSpamHandled) {
          return;
        }

        const profanityHandled = await handleProfanityModal(interaction, botConfig);
        if (profanityHandled) {
          return;
        }

        const handled = await handleSetupModal(interaction, botConfig);
        if (handled) {
          return;
        }
      }

      if (!interaction.inGuild()) {
        return;
      }

      const guildConfig = resolveGuildConfig(botConfig, interaction.guildId);
      await handleSlashCommand(interaction, guildConfig, botConfig);
    } catch (error) {
      console.error("Unhandled Discord interaction error.", error);

      if (interaction.isRepliable()) {
        const failureMessage = "An unexpected error occurred while processing that interaction.";
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({content: failureMessage, flags: MessageFlags.Ephemeral}).catch(() => undefined);
        } else {
          await interaction.reply({content: failureMessage, flags: MessageFlags.Ephemeral}).catch(() => undefined);
        }
      }
    }
  });

  client.on(Events.MessageCreate, async (message) => {
    try {
      const guildConfig = message.guildId ? resolveGuildConfig(botConfig, message.guildId) : botConfig.global;
      await handleMessage(message, client, guildConfig, moderationEngineManager);
    } catch (error) {
      console.error("Unhandled Discord message handler error.", error);
    }
  });

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    try {
      const guildId = reaction.message.guildId;
      const guildConfig = guildId ? resolveGuildConfig(botConfig, guildId) : botConfig.global;
      const accessHandled = await handleAccessEmojiReaction(reaction, user, guildConfig);
      if (accessHandled) {
        return;
      }
    } catch (error) {
      console.error("Unhandled Discord reaction handler error.", error);
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const guildConfig = resolveGuildConfig(botConfig, member.guild.id);
      await handleAccessMemberJoin(member, guildConfig);
    } catch (error) {
      console.error("Unhandled Discord member join handler error.", error);
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      const guildConfig = resolveGuildConfig(botConfig, member.guild.id);
      await handleAccessMemberLeave(member, guildConfig);
    } catch (error) {
      console.error("Unhandled Discord member leave handler error.", error);
    }
  });
}