export const SettingsSchema = {
	/**
	 * Self mode a.k.a. `"Only me"` mode
	 */
	self: Boolean,
	/**
	 * Group mode a.k.a. `"Everyone in the group"` mode
	 */
	groupOnly: Boolean,
	/**
	 * Private chat mode a.k.a. `"Only me and the bot"`
	 */
	privateChatOnly: Boolean,
};
