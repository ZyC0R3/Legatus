/**
 * Module: scanmember
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {MessageFlags, SlashCommandBuilder, type ChatInputCommandInteraction} from "discord.js";

const targetUserFlags = [
  {name: "SPAMMER", bit: 1n << 20n},
  {name: "HIGH_GLOBAL_RATE_LIMIT", bit: 1n << 33n},
  {name: "DISABLED_SUSPICIOUS_ACTIVITY", bit: 1n << 35n},
  {name: "DISABLED", bit: 1n << 41n},
  {name: "QUARANTINED", bit: 1n << 44n}
] as const;

type MatchedUser = {
  userId: string;
  matchedFlags: string[];
};

// resolveMatchedFlags defines this module's public behavior or core flow.
function resolveMatchedFlags(userFlagsBitfield: bigint): string[] {
  return targetUserFlags
    .filter((flag) => (userFlagsBitfield & flag.bit) !== 0n)
    .map((flag) => flag.name);
}

// chunkLines defines this module's public behavior or core flow.
function chunkLines(lines: string[], maxChars = 1700): string[] {
  if (lines.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current.length === 0 ? line : `${current}\n${line}`;
    if (next.length > maxChars) {
      if (current.length > 0) {
        chunks.push(current);
      }
      current = line;
    } else {
      current = next;
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export const scanmembersCommand = {
  data: new SlashCommandBuilder()
    .setName("scanmembers")
    .setDescription("Scan all guild members for high-risk Discord user flags."),
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral
      });
      return;
    }

    await interaction.deferReply({flags: MessageFlags.Ephemeral});

    const guildMembers = await guild.members.fetch();
    const totalMembers = guildMembers.size;
    const matches: MatchedUser[] = [];
    let scannedCount = 0;

    await interaction.editReply({
      content: `Scanning in progress ${scannedCount}/${totalMembers}`
    });

    for (const [, member] of guildMembers) {
      scannedCount += 1;

      // Only hit the API when flags are missing locally to avoid one request per member.
      const fetchedUser = member.user.flags
        ? member.user
        : await member.user.fetch().catch(() => member.user);
      const rawBitfield = fetchedUser.flags?.bitfield;
      const userFlagsBitfield = typeof rawBitfield === "bigint"
        ? rawBitfield
        : BigInt(rawBitfield ?? 0);
      const matchedFlags = resolveMatchedFlags(userFlagsBitfield);
      if (matchedFlags.length === 0) {
        continue;
      }

      matches.push({
        userId: member.id,
        matchedFlags
      });

      if (scannedCount % 15 === 0 || scannedCount === totalMembers) {
        void interaction.editReply({
          content: `Scanning in progress ${scannedCount}/${totalMembers}`
        }).catch(() => undefined);
      }
    }

    if (matches.length === 0) {
      await interaction.editReply({
        content: "No members with SPAMMER, HIGH_GLOBAL_RATE_LIMIT, DISABLED_SUSPICIOUS_ACTIVITY, DISABLED, or QUARANTINED flags were found."
      });
      return;
    }

    const reportLines = matches.map((match) => {
      return `- <@${match.userId}> (${match.userId}) | ${match.matchedFlags.join(", ")}`;
    });

    const chunks = chunkLines(reportLines);
    const summary = `Found ${matches.length} flagged member${matches.length === 1 ? "" : "s"}.`;

    await interaction.editReply({
      content: [summary, chunks[0]].filter((value) => Boolean(value)).join("\n\n")
    });

    for (let index = 1; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      if (!chunk) {
        continue;
      }

      await interaction.followUp({
        content: chunk,
        flags: MessageFlags.Ephemeral
      });
    }
  }
};
