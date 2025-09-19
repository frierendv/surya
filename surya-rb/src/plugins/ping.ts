import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "ping-",
	command: ["ping", "p"],
	category: ["utility"],
	description: "Ping the bot to check if it's alive.",
	execute: async (ctx) => {
		await ctx.reply("Pong!");
	},
} satisfies IPlugin;
