/**
 * Module: schema
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
import {z} from "zod";

export type ProfanityLevel = "low" | "medium" | "high" | "critical";
export type ProfanityLoggingLevel = "none" | "violations" | "violations-and-moderations" | "all";
export type AccessJoinLeaveLoggingMode = "none" | "join" | "leave" | "both";

export interface ProfanityRuleConfig {
  muteLengthMs: number | null;
  kick: boolean | null;
  ban: boolean | null;
  openThread: boolean | null;
}

export interface ProfanityRulesConfig {
  low: ProfanityRuleConfig;
  medium: ProfanityRuleConfig;
  high: ProfanityRuleConfig;
  critical: ProfanityRuleConfig;
}

export interface ProfanityCleanupConfig {
  deleteOriginalMessage: boolean;
  postMessageInChannel: boolean;
  messageToPost: string;
  addRoleId: string | null;
  removeRoleId: string | null;
}

export interface ProfanityLoggingConfig {
  channelId: string | null;
  level: ProfanityLoggingLevel;
}

export interface GuildConfig {
  commandRoleIds: string[];
  respondRoleIds: string[];
  moderationMentionRoleIds: string[];
  joinRoleId: string | null;
  moderationNoPingRoleIds: string[];
  ignoredRoleIds: string[];
  ignoredUserIds: string[];
  accessPasswordPhrase: string;
  accessPasswordRoleId: string | null;
  accessPasswordRemoveRoleId: string | null;
  accessPasswordChannelId: string | null;
  accessEmojiValue: string;
  accessEmojiRoleId: string | null;
  accessEmojiRemoveRoleId: string | null;
  accessEmojiChannelId: string | null;
  accessEmojiMessageId: string | null;
  accessEmojiMessageContent: string;
  accessWelcomeMessage: string;
  accessWelcomeMessageChannelId: string | null;
  accessJoinLeaveLogging: AccessJoinLeaveLoggingMode;
  accessJoinLeaveLoggingChannelId: string | null;
  profanityLowTerms: string;
  profanityMediumTerms: string;
  profanityHighTerms: string;
  profanityCriticalTerms: string;
  profanityTermsConfigured: boolean;
  profanityActiveLevels: ProfanityLevel[];
  profanityRules: ProfanityRulesConfig;
  profanityCleanup: ProfanityCleanupConfig;
  profanityLogging: ProfanityLoggingConfig;
  messageTriggers: string[];
  mentionRepliesEnabled: boolean;
  moderationChannelId: string | null;
  moderationCategoryId: string | null;
  moderationChannelMode: "existing" | "new" | null;
  isHoneyPotChannel: boolean;
  moderationTimeoutMs: number;
  messageDeletionWindowMs: number;
  moderationThreadMessage: string;
  honeyPotChannelMessage: string;
}

export interface BotConfig {
  version: 1;
  global: GuildConfig;
  guilds: Record<string, GuildConfig>;
}

export const defaultGuildConfig: GuildConfig = {
  commandRoleIds: [],
  respondRoleIds: [],
  moderationMentionRoleIds: [],
  joinRoleId: null,
  moderationNoPingRoleIds: [],
  ignoredRoleIds: [],
  ignoredUserIds: [],
  accessPasswordPhrase: "",
  accessPasswordRoleId: null,
  accessPasswordRemoveRoleId: null,
  accessPasswordChannelId: null,
  accessEmojiValue: "",
  accessEmojiRoleId: null,
  accessEmojiRemoveRoleId: null,
  accessEmojiChannelId: null,
  accessEmojiMessageId: null,
  accessEmojiMessageContent: "",
  accessWelcomeMessage: "",
  accessWelcomeMessageChannelId: null,
  accessJoinLeaveLogging: "none",
  accessJoinLeaveLoggingChannelId: null,
  profanityLowTerms: "arse ,arsehole ,ass ,asses ,asshat ,asshead ,asswipe ,asswad ,asshole ,assholes ,assface ,assclown ,assmonkey ,assmunch ,assmuncher ,assbag ,bastard ,bastards ,bellend ,bitch ,bitches ,bitching ,bitchy ,bitchass ,bollock ,bollocks ,bugger ,buggered ,bullcrap ,bullshit ,bullshits ,bumhole ,butthead ,butthole ,crap ,crappy ,damn ,dammit ,damnit ,dick ,dicks ,dickhead ,dickheads ,dickwad ,dickweed ,dimwit ,dipshit ,douche ,douchebag ,dumbass ,dumbasses ,dumbshit ,fart ,farty ,feck ,frigg ,frigga ,frigging ,friggin ,fuck ,fucked ,fucker ,fuckers ,fucking ,fucks ,fuckwit ,fuckwitt ,fuckoff ,fuckup ,fuckwad ,fuckface ,fuckhead ,hell ,hells ,horseshit ,jackass ,jackhole ,jerk ,knob ,knobhead ,knobend ,knobead ,moron ,nimrod ,nob ,nobhead ,numbnuts ,pillock ,piss ,pissed ,pisser ,pisses ,pissing ,pisshead ,poo ,poop ,prick ,pricks ,shit ,shitbag ,shitbags ,shitface ,shithead ,shithole ,shits ,shitter ,shitters ,shitting ,shitty ,shiz ,slag ,slapper ,smeg ,sob ,twat ,wanker ,wanker ,whore ,whorebag",
  profanityMediumTerms: "anal ,analannie ,analprobe ,analsex ,anus ,asscock ,asswhore ,barenaked ,bdsm ,big breasts ,big tits ,bigbreasts ,bigtits ,bitchtit ,black cock ,blackcock ,blow j ,blow job ,blow your l ,blow your load ,blowjob ,blowjobs ,boner ,boners ,boob ,boobies ,boobs ,booby ,boobz ,breastjob ,breastlover ,breastman ,butt plug ,buttplug ,camslut ,camwhore ,clit ,clitface ,clitfuck ,clitoris ,clitorus ,clits ,clitty ,cock ,cock-head ,cock-sucker ,cockbite ,cockblock ,cockblocker ,cockburger ,cockcowboy ,cockface ,cockfight ,cockfucker ,cockhead ,cockholster ,cockknob ,cockknocker ,cocklicker ,cocklover ,cockmonkey ,cockmunch ,cockmuncher ,cocknob ,cocknose ,cocknugget ,cockqueen ,cockrider ,cocks ,cockshit ,cocksman ,cocksmith ,cocksmoker ,cocksucer ,cocksuck ,cocksucked ,cocksucker ,cocksucking ,cocksucks ,cocksuka ,cocksukka ,cocktease ,cocky ,crackwhore ,cum ,cumbubble ,cumdumpster ,cumfest ,cumjockey ,cumm ,cummer ,cummin ,cumming ,cumquat ,cumqueen ,cums ,cumshot ,cumshots ,cumslut ,cumstain ,cumtart ,cunt ,cunteyed ,cuntface ,cuntfuck ,cuntfucker ,cunthole ,cunthunter ,cuntlick ,cuntlicker ,cuntlicking ,cuntrag ,cunts ,cuntslut ,cuntsucker ,cuntz ,cybersex ,destroyyourpussy ,dick pic ,dildo ,dildos ,easyslut ,eatpussy ,ejaculate ,ejaculated ,ejaculates ,ejaculating ,ejaculation ,escort ,fetish ,fisting ,foot fetish ,footfetish ,fuckwhore ,genital ,genitals ,getiton ,hardcoresex ,hentai ,hooker ,hookers ,horny ,hotpussy ,hotsex ,labia ,makemecum ,masturbate ,masturbating ,masturbation ,milf ,naked ,nastyslut ,nastywhore ,nipple ,nipples ,nsfw ,nsfw images ,nude ,oral ,orally ,orgasm ,orgasmic ,orgasms ,penis ,penises ,penislick ,phone sex ,porn ,porno ,pornography ,pornos ,prostitute ,pussy ,pussyeater ,pussylicker ,pussylover ,rimjob ,rimming ,semen ,sex ,sexual ,sextoy ,sextoys ,sexy ,shaved pussy ,slut ,slutbag ,sluts ,slutty ,slutwhore ,tit ,titjob ,tits ,titties ,titty ,tittyfuck ,vagina ,vaginal ,whore ,whorebag ,whoreface ,whores ,xxx",
  profanityHighTerms: "abuse ,abuser ,ableist ,bitchslap ,bully ,bullying ,child groomer ,childgroomer ,creep ,creepy ,date rape ,daterape ,dox ,doxx ,doxxing ,dumbfuck ,eat my ass ,eatmyass ,fatass ,fatfuck ,fatfucker ,groom ,groomed ,groomer ,grooming ,harass ,harassed ,harasser ,harassing ,harassment ,hate you ,hitman ,how to kill ,how to murder ,kill ,killer ,killing ,kills ,killthem ,killyourself ,lynch ,molest ,molestation ,molester ,murder ,murderer ,murdering ,paedophile ,pedo ,pedobear ,pedophile ,pedophilia ,pedophiliac ,rape ,raped ,raper ,raping ,rapist ,retard ,retarded ,retards ,retardz ,reetard ,ritard ,rtard ,rtards ,r-tard ,r-tards ,self harm ,self-harm ,sexual harassment ,shoot you ,stab you ,suicide ,swat ,swatting ,threat ,threaten ,threatened ,threatening ,violent ,violence",
  profanityCriticalTerms: "",
  profanityTermsConfigured: false,
  profanityActiveLevels: [],
  profanityRules: {
    low: {muteLengthMs: null, kick: null, ban: null, openThread: null},
    medium: {muteLengthMs: null, kick: null, ban: null, openThread: null},
    high: {muteLengthMs: null, kick: null, ban: null, openThread: null},
    critical: {muteLengthMs: null, kick: null, ban: null, openThread: null}
  },
  profanityCleanup: {
    deleteOriginalMessage: false,
    postMessageInChannel: false,
    messageToPost: "",
    addRoleId: null,
    removeRoleId: null
  },
  profanityLogging: {
    channelId: null,
    level: "none"
  },
  messageTriggers: ["hello legatus", "hey legatus"],
  mentionRepliesEnabled: true,
  moderationChannelId: null,
  moderationCategoryId: null,
  moderationChannelMode: null,
  isHoneyPotChannel: false,
  moderationTimeoutMs: 60 * 60 * 1000,
  messageDeletionWindowMs: 60 * 1000,
  moderationThreadMessage: "This is the message automatically posted for the user to see when the moderation thread is opened.",
  honeyPotChannelMessage: "This channel is reserved for automated server functions. Any message sent here will automatically trigger a 1-hour timeout.\nIf you're looking for help or wish to chat, please use the appropriate channels."
};

export const guildConfigSchema = z.object({
  commandRoleIds: z.array(z.string().min(1)).default([]),
  respondRoleIds: z.array(z.string().min(1)).default([]),
  moderationMentionRoleIds: z.array(z.string().min(1)).default([]),
  joinRoleId: z.string().min(1).nullable().default(null),
  moderationNoPingRoleIds: z.array(z.string().min(1)).default([]),
  ignoredRoleIds: z.array(z.string().min(1)).default([]),
  ignoredUserIds: z.array(z.string().min(1)).default([]),
  accessPasswordPhrase: z.string().default(""),
  accessPasswordRoleId: z.string().min(1).nullable().default(null),
  accessPasswordRemoveRoleId: z.string().min(1).nullable().default(null),
  accessPasswordChannelId: z.string().min(1).nullable().default(null),
  accessEmojiValue: z.string().default(""),
  accessEmojiRoleId: z.string().min(1).nullable().default(null),
  accessEmojiRemoveRoleId: z.string().min(1).nullable().default(null),
  accessEmojiChannelId: z.string().min(1).nullable().default(null),
  accessEmojiMessageId: z.string().min(1).nullable().default(null),
  accessEmojiMessageContent: z.string().default(""),
  accessWelcomeMessage: z.string().default(""),
  accessWelcomeMessageChannelId: z.string().min(1).nullable().default(null),
  accessJoinLeaveLogging: z.enum(["none", "join", "leave", "both"]).default("none"),
  accessJoinLeaveLoggingChannelId: z.string().min(1).nullable().default(null),
  profanityLowTerms: z.string().default("arse ,arsehole ,ass ,asses ,asshat ,asshead ,asswipe ,asswad ,asshole ,assholes ,assface ,assclown ,assmonkey ,assmunch ,assmuncher ,assbag ,bastard ,bastards ,bellend ,bitch ,bitches ,bitching ,bitchy ,bitchass ,bollock ,bollocks ,bugger ,buggered ,bullcrap ,bullshit ,bullshits ,bumhole ,butthead ,butthole ,crap ,crappy ,damn ,dammit ,damnit ,dick ,dicks ,dickhead ,dickheads ,dickwad ,dickweed ,dimwit ,dipshit ,douche ,douchebag ,dumbass ,dumbasses ,dumbshit ,fart ,farty ,feck ,frigg ,frigga ,frigging ,friggin ,fuck ,fucked ,fucker ,fuckers ,fucking ,fucks ,fuckwit ,fuckwitt ,fuckoff ,fuckup ,fuckwad ,fuckface ,fuckhead ,hell ,hells ,horseshit ,jackass ,jackhole ,jerk ,knob ,knobhead ,knobend ,knobead ,moron ,nimrod ,nob ,nobhead ,numbnuts ,pillock ,piss ,pissed ,pisser ,pisses ,pissing ,pisshead ,poo ,poop ,prick ,pricks ,shit ,shitbag ,shitbags ,shitface ,shithead ,shithole ,shits ,shitter ,shitters ,shitting ,shitty ,shiz ,slag ,slapper ,smeg ,sob ,twat ,wanker ,wanker ,whore ,whorebag"),
  profanityMediumTerms: z.string().default("anal ,analannie ,analprobe ,analsex ,anus ,asscock ,asswhore ,barenaked ,bdsm ,big breasts ,big tits ,bigbreasts ,bigtits ,bitchtit ,black cock ,blackcock ,blow j ,blow job ,blow your l ,blow your load ,blowjob ,blowjobs ,boner ,boners ,boob ,boobies ,boobs ,booby ,boobz ,breastjob ,breastlover ,breastman ,butt plug ,buttplug ,camslut ,camwhore ,clit ,clitface ,clitfuck ,clitoris ,clitorus ,clits ,clitty ,cock ,cock-head ,cock-sucker ,cockbite ,cockblock ,cockblocker ,cockburger ,cockcowboy ,cockface ,cockfight ,cockfucker ,cockhead ,cockholster ,cockknob ,cockknocker ,cocklicker ,cocklover ,cockmonkey ,cockmunch ,cockmuncher ,cocknob ,cocknose ,cocknugget ,cockqueen ,cockrider ,cocks ,cockshit ,cocksman ,cocksmith ,cocksmoker ,cocksucer ,cocksuck ,cocksucked ,cocksucker ,cocksucking ,cocksucks ,cocksuka ,cocksukka ,cocktease ,cocky ,crackwhore ,cum ,cumbubble ,cumdumpster ,cumfest ,cumjockey ,cumm ,cummer ,cummin ,cumming ,cumquat ,cumqueen ,cums ,cumshot ,cumshots ,cumslut ,cumstain ,cumtart ,cunt ,cunteyed ,cuntface ,cuntfuck ,cuntfucker ,cunthole ,cunthunter ,cuntlick ,cuntlicker ,cuntlicking ,cuntrag ,cunts ,cuntslut ,cuntsucker ,cuntz ,cybersex ,destroyyourpussy ,dick pic ,dildo ,dildos ,easyslut ,eatpussy ,ejaculate ,ejaculated ,ejaculates ,ejaculating ,ejaculation ,escort ,fetish ,fisting ,foot fetish ,footfetish ,fuckwhore ,genital ,genitals ,getiton ,hardcoresex ,hentai ,hooker ,hookers ,horny ,hotpussy ,hotsex ,labia ,makemecum ,masturbate ,masturbating ,masturbation ,milf ,naked ,nastyslut ,nastywhore ,nipple ,nipples ,nsfw ,nsfw images ,nude ,oral ,orally ,orgasm ,orgasmic ,orgasms ,penis ,penises ,penislick ,phone sex ,porn ,porno ,pornography ,pornos ,prostitute ,pussy ,pussyeater ,pussylicker ,pussylover ,rimjob ,rimming ,semen ,sex ,sexual ,sextoy ,sextoys ,sexy ,shaved pussy ,slut ,slutbag ,sluts ,slutty ,slutwhore ,tit ,titjob ,tits ,titties ,titty ,tittyfuck ,vagina ,vaginal ,whore ,whorebag ,whoreface ,whores ,xxx"),
  profanityHighTerms: z.string().default("abuse ,abuser ,ableist ,bitchslap ,bully ,bullying ,child groomer ,childgroomer ,creep ,creepy ,date rape ,daterape ,dox ,doxx ,doxxing ,dumbfuck ,eat my ass ,eatmyass ,fatass ,fatfuck ,fatfucker ,groom ,groomed ,groomer ,grooming ,harass ,harassed ,harasser ,harassing ,harassment ,hate you ,hitman ,how to kill ,how to murder ,kill ,killer ,killing ,kills ,killthem ,killyourself ,lynch ,molest ,molestation ,molester ,murder ,murderer ,murdering ,paedophile ,pedo ,pedobear ,pedophile ,pedophilia ,pedophiliac ,rape ,raped ,raper ,raping ,rapist ,retard ,retarded ,retards ,retardz ,reetard ,ritard ,rtard ,rtards ,r-tard ,r-tards ,self harm ,self-harm ,sexual harassment ,shoot you ,stab you ,suicide ,swat ,swatting ,threat ,threaten ,threatened ,threatening ,violent ,violence"),
  profanityCriticalTerms: z.string().default(""),
  profanityTermsConfigured: z.boolean().default(false),
  profanityActiveLevels: z.array(z.enum(["low", "medium", "high", "critical"])).default([]),
  profanityRules: z.object({
    low: z.object({
      muteLengthMs: z.number().int().positive().nullable().default(null),
      kick: z.boolean().nullable().default(null),
      ban: z.boolean().nullable().default(null),
      openThread: z.boolean().nullable().default(null)
    }).default({muteLengthMs: null, kick: null, ban: null, openThread: null}),
    medium: z.object({
      muteLengthMs: z.number().int().positive().nullable().default(null),
      kick: z.boolean().nullable().default(null),
      ban: z.boolean().nullable().default(null),
      openThread: z.boolean().nullable().default(null)
    }).default({muteLengthMs: null, kick: null, ban: null, openThread: null}),
    high: z.object({
      muteLengthMs: z.number().int().positive().nullable().default(null),
      kick: z.boolean().nullable().default(null),
      ban: z.boolean().nullable().default(null),
      openThread: z.boolean().nullable().default(null)
    }).default({muteLengthMs: null, kick: null, ban: null, openThread: null}),
    critical: z.object({
      muteLengthMs: z.number().int().positive().nullable().default(null),
      kick: z.boolean().nullable().default(null),
      ban: z.boolean().nullable().default(null),
      openThread: z.boolean().nullable().default(null)
    }).default({muteLengthMs: null, kick: null, ban: null, openThread: null})
  }).default({
    low: {muteLengthMs: null, kick: null, ban: null, openThread: null},
    medium: {muteLengthMs: null, kick: null, ban: null, openThread: null},
    high: {muteLengthMs: null, kick: null, ban: null, openThread: null},
    critical: {muteLengthMs: null, kick: null, ban: null, openThread: null}
  }),
  profanityCleanup: z.object({
    deleteOriginalMessage: z.boolean().default(false),
    postMessageInChannel: z.boolean().default(false),
    messageToPost: z.string().default(""),
    addRoleId: z.string().min(1).nullable().default(null),
    removeRoleId: z.string().min(1).nullable().default(null)
  }).default({
    deleteOriginalMessage: false,
    postMessageInChannel: false,
    messageToPost: "",
    addRoleId: null,
    removeRoleId: null
  }),
  profanityLogging: z.object({
    channelId: z.string().min(1).nullable().default(null),
    level: z.enum(["none", "violations", "violations-and-moderations", "all"]).default("none")
  }).default({
    channelId: null,
    level: "none"
  }),
  messageTriggers: z.array(z.string().min(1)).default(["hello legatus", "hey legatus"]),
  mentionRepliesEnabled: z.boolean().default(true),
  moderationChannelId: z.string().min(1).nullable().default(null),
  moderationCategoryId: z.string().min(1).nullable().default(null),
  moderationChannelMode: z.enum(["existing", "new"]).nullable().default(null),
  isHoneyPotChannel: z.boolean().default(false),
  moderationTimeoutMs: z.number().int().positive().default(60 * 60 * 1000),
  messageDeletionWindowMs: z.number().int().positive().default(60 * 1000),
  moderationThreadMessage: z.string().min(1).default("This is the message automatically posted for the user to see when the moderation thread is opened."),
  honeyPotChannelMessage: z.string().min(1).default("This channel is reserved for automated server functions. Any message sent here will automatically trigger a 1-hour timeout.\nIf you're looking for help or wish to chat, please use the appropriate channels.")
});

export const botConfigSchema = z.object({
  version: z.literal(1).default(1),
  global: guildConfigSchema.default(defaultGuildConfig),
  guilds: z.record(z.string(), guildConfigSchema).default({})
});

export const defaultBotConfig: BotConfig = {
  version: 1,
  global: defaultGuildConfig,
  guilds: {}
};
