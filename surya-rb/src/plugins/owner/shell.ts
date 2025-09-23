import { exec } from "child_process";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "call-shell",
	command: ["$"],
	ignorePrefix: true,
	category: ["owner"],
	ownerOnly: true,
	description: "Execute shell command on the server.",
	execute: async (ctx) => {
		if (!ctx.text) {
			await ctx.reply("Please provide a command to execute.");
			return;
		}
		try {
			const result = await new Promise((resolve, reject) => {
				exec(ctx.text, (error, stdout, stderr) => {
					if (error) {
						reject(error);
					} else {
						resolve(stdout || stderr);
					}
				});
			});
			await ctx.reply(`${result}`.trim());
		} catch (error) {
			await ctx.reply(`${error}`.trim());
		}
	},
} satisfies IPlugin;
