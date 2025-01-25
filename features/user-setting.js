/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["enable", "disable"],
	description: "Enable some feature",
	category: "Main",
	owner: false,
	group: false,
	admin: false,
	hidden: false,
	limit: false,
	private: false,

	features: ["translate"],

	execute: async function (ctx, { db, text, command }) {
		if (!text) {
			return ctx.reply(
				`Please specify the feature you want to ${command}\n\nAvailable features:\n${this.features
					.map((f) => `• ${f}`)
					.join("\n")}`
			);
		}
		const userJid = ctx.sender;
		const feature = text.toLowerCase();

		if (!this.features.includes(feature)) {
			return;
		}
		const user = db.users.get(userJid);
		if (!user) {
			return ctx.reply("Failed to get user data");
		}
		user[feature] = command === "enable";

		await ctx.reply(
			`${
				command === "enable" ? "Enabled" : "Disabled"
			} *${feature}* feature`
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
