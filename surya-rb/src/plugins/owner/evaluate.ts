import { inspect } from "util";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "evaluate-js",
	command: ["->"],
	ignorePrefix: true,
	category: ["owner"],
	ownerOnly: true,
	description: "Evaluate JavaScript code.",
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	execute: async (ctx, extra) => {
		if (!ctx.text) {
			await ctx.reply("Please provide a command to execute.");
			return;
		}
		try {
			let result = await eval(ctx.text);
			if (typeof result === "object") {
				result = inspect(result, { depth: 2 });
			}
			await ctx.reply(`${result}`.trim());
		} catch (error) {
			await ctx.reply(`${error}`.trim());
		}
	},
} satisfies IPlugin;
