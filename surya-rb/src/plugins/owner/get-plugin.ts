import { readFileSync } from "fs";
import pm from "@libs/plugin-manager";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "get-plugin",
	command: ["get-plugin", "gp"],
	category: ["owner"],
	ownerOnly: true,
	description: "Get the source code of a plugin.",
	execute: async (ctx, { usedPrefix, command }) => {
		if (!ctx.text) {
			await ctx.reply(
				`Usage: ${usedPrefix}${command} <plugin name>\nExample: ${usedPrefix}${command} ping`
			);
			return;
		}
		const plugins = pm
			.list()
			.filter((p) => p.name === ctx.text || p.command.includes(ctx.text));
		if (plugins.length === 0) {
			await ctx.reply("No plugin found with that name.");
			return;
		}
		if (plugins.length > 1) {
			await ctx.reply(
				`Multiple plugins found with that name:\n${plugins
					.map(
						(p) =>
							`- ${p.name} (commands: ${(Array.isArray(p.command)
								? p.command
								: [p.command]
							).join(", ")})`
					)
					.join("\n")}\nPlease be more specific.`
			);
			return;
		}
		const plugin = plugins[0] as IPlugin;
		try {
			// hacky way to get the file path of the plugin
			// since we don't store the file path in the plugin object
			// we can only access it through the plugin manager's private properties
			// this is not ideal, but it works for now
			const fp = ((pm as any).nameToFile as any).get(
				plugin.name
			) as string;
			await ctx.reply(readFileSync(fp, "utf-8"));
		} catch (err) {
			await ctx.reply("Failed to get plugin source code.");
			console.error(err);
		}
	},
} satisfies IPlugin;
