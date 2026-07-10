/**
 * Module: constants
 * Purpose: Coordinates this part of the Legatus bot flow.
 */
export const setupButtonIds = {
  setRoles: "legatus-setup-set-roles",
  setJoinRole: "8d7ec0f70e1f4a7f8cf0bcf531886f31",
  setAccessPassword: "ad874a1686544693d6a291966a2d02c8",
  setAccessEmoji: "f9fac0439ce247ba87ee772fe7e769c4",
  setAccessExtras: "3c89bfc632f34f0f89b5704536f9e26f",
  accessNext: "312f23d396fc45ba84b8b807d0167e17",
  useExistingChannel: "legatus-setup-use-existing-channel",
  createNewChannel: "legatus-setup-create-new-channel",
  setModerationConfig: "legatus-setup-set-moderation-config",
  setTriggerMessages: "legatus-setup-trigger-messages",
  next: "26886470c00f4d27e83672e61e7ca076",
  cancelRoles: "legatus-setup-cancel-roles",
  cancelAccess: "a796e86dafe34c10923f2bc5e05e3460",
  cancelChannels: "legatus-setup-cancel-channels",
  cancelModeration: "legatus-setup-cancel-moderation",
  cancelTriggers: "legatus-setup-cancel-triggers"
} as const;

export const setupModalId = "legatus-setup-roles-modal";
export const joinLeaveRoleModalId = "legatus-setup-join-leave-role-modal";
export const accessPasswordModalId = "legatus-setup-access-password-modal";
export const accessEmojiModalId = "legatus-setup-access-emoji-modal";
export const accessExtrasModalId = "legatus-setup-access-extras-modal";
export const existingChannelModalId = "legatus-setup-existing-channel-modal";
export const createChannelModalId = "legatus-setup-create-channel-modal";
export const moderationConfigModalId = "legatus-setup-moderation-config-modal";
export const triggerMessagesModalId = "legatus-setup-trigger-messages-modal";

export const headModeratorRolesId = "009721ecd9804c708ffab429dd4eee49";
export const moderatorRolesId = "187aa8ea3eb54c6dbc175ad3ff0c0c25";
export const moderationMentionRolesId = "ed489388a818419a956fc72338dd8a6a";
export const moderationNoPingRolesId = "661c39d142a0421ba77f5a4e616b27b0";
export const ignoredRolesId = "685b552968bb4c59855e0e8b610a39f5";
export const joinRoleId = "97f33aa1f8924eef9b755b2a5e7ffed3";

export const channelSelectId = "8de26c4207884736a5e1e4cd2ab7c9d6";
export const honeyPotSelectId = "4064bffa89cb493fa1a6ac08697c804e";
export const honeyPotYesValue = "acf2e65437564c87b428819ee0ad5444";
export const honeyPotNoValue = "6c16c181ada24496a46944d3a6b5ff2f";
export const channelNameInputId = "48026db3e1f84dbf895700180d20afc3";

export const moderationTimeoutSelectId = "63d19a04ee5e43adbad5c4eb9943c33c";
export const messageDeletionWindowSelectId = "205f30f8031f40b6a8581978edbbaf5f";
export const moderationThreadMessageId = "99cfaf17a6f14b8d95e70dc250d86512";
export const honeyPotChannelMessageId = "31e1376181a9437fa081a6ad8a7d958c";

export const accessPasswordPhraseId = "56cc30b7acc94960925461f54643bbae";
export const accessPasswordRoleId = "d1aa0b5acec44f49b689883c594bd451";
export const accessPasswordRemoveRoleId = "dea0adea46244893b221ac7b60e284ca";
export const accessPasswordChannelId = "d1f544abce224c128d010611df7c21e9";
export const accessEmojiMessageOrIdId = "799feb189c2f4716aff832bcf9e7e4a4";
export const accessEmojiValueId = "7c8bde96740e45c2a89aac98656ef1cc";
export const accessEmojiRoleId = "1c13affecdca45829b2640fa73a7b4fc";
export const accessEmojiRemoveRoleId = "bde5920997e146cca553b2bf619fb9d3";
export const accessEmojiChannelId = "e1bde9f6e8cd4dc1865b0b18d12d4d63";
export const accessWelcomeMessageId = "03dd679cac7247e99020a6ff6865b25f";
export const accessWelcomeMessageChannelId = "63daeb3cf2274c7aae915750e883839e";
export const accessJoinLeaveLoggingId = "040256cf203f47e39e3e6f3586e9ca57";
export const accessJoinLeaveLoggingChannelId = "eed63255921949bd8bfe6dec6a685258";

export const accessJoinOnlyValue = "e54da71bfed5489ea3e1cfed660ee74f";
export const accessLeaveOnlyValue = "55b888e535c44272af1b2e4b889188c4";
export const accessJoinAndLeaveValue = "fc0e9165c8834ba0b2b239d572123ba6";
