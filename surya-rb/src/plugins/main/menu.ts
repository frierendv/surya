import pm from "@libs/plugin-manager";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "display-menu",
	command: ["help", "menu"],
	description: "Display this menu",
	category: ["Main"],
	execute: async (ctx, { usedPrefix, isOwner, command: usedCommand }) => {
		const list = pm.list();

		// helpers
		const normalize = (s?: string) => (s ?? "").trim().toLowerCase();
		const getCommands = (p: IPlugin) =>
			(Array.isArray(p.command)
				? p.command
				: p.command
					? [p.command]
					: []
			).map(String);
		const pluginVisible = (p: IPlugin) => {
			if (p.hidden && !isOwner) {
				return false;
			}
			if (p.ownerOnly && !isOwner) {
				return false;
			}
			if (p.disabled && !isOwner) {
				return false;
			}
			return true;
		};
		const stripPrefix = (cmd: string) =>
			cmd.startsWith(usedPrefix) ? cmd.slice(usedPrefix.length) : cmd;

		const findPlugin = (query: string | undefined) => {
			if (!query) {
				return undefined;
			}
			const q = normalize(query);
			return list.find((p) => {
				if (!pluginVisible(p)) {
					return false;
				}
				// match name
				if (normalize(p.name) === q) {
					return true;
				}
				// match commands with/without prefix
				for (const c of getCommands(p)) {
					if (normalize(c) === q) {
						return true;
					}
					if (normalize(stripPrefix(c)) === q) {
						return true;
					}
					if (normalize(`${usedPrefix}${c}`) === q) {
						return true;
					}
				}
				return false;
			});
		};

		// If command is "help" with an argument, show detailed help for that command
		if (usedCommand === "help" && ctx.args[0]) {
			const requested = ctx.args[0];
			const plugin = findPlugin(requested);

			if (!plugin || !pluginVisible(plugin)) {
				await ctx.reply(`No command found for "${requested}".`);
				return;
			}

			const cmds = getCommands(plugin);
			const cats = Array.isArray(plugin.category)
				? plugin.category
				: plugin.category
					? [plugin.category]
					: [];

			// build detailed help message
			const lines: string[] = [];
			lines.push("```" + `${plugin.name}` + "```");
			if (cats.length) {
				lines.push("");
				lines.push(
					`- Category: ${cats.map((c) => `*${c}*`).join(", ")}`
				);
			}

			// Usage: prefer explicit usage field, otherwise show first command form
			const usage =
				(plugin as any).usage ||
				(cmds.length
					? `${!plugin.ignorePrefix ? usedPrefix : ""}${cmds[0]}`
					: null);
			if (usage) {
				lines.push(`- Usage: ${usage}`);
			}

			// Aliases
			if (cmds.length > 1) {
				lines.push(
					`- Aliases: ${cmds
						.map(
							(c) =>
								`*${!plugin.ignorePrefix ? usedPrefix : ""}${c}*`
						)
						.join(", ")}`
				);
			}

			// Flags / restrictions
			const flags: string[] = [];
			if (plugin.ownerOnly) {
				flags.push("owner only");
			}
			if (plugin.hidden) {
				flags.push("hidden");
			}
			if (plugin.privateChatOnly) {
				flags.push("private chat only");
			}
			if (plugin.groupChatOnly) {
				flags.push("group chat only");
			}
			if (flags.length) {
				lines.push(`Restrictions: *${flags.join(", ")}*`);
			}

			if (plugin.description) {
				lines.push("");
				lines.push(`> ${plugin.description}`);
			}

			await ctx.reply(lines.join("\n").trim());
			return;
		}

		// Build filtered and grouped plugin list
		const categoryFilter = normalize(ctx.text);

		const categories: Record<string, IPlugin[]> = {};
		for (const plugin of list) {
			if (!pluginVisible(plugin)) {
				continue;
			}

			const pluginName = normalize(plugin.name);
			const pluginDesc = normalize(plugin.description);
			const pluginCmds = getCommands(plugin).map(normalize);

			const cats = Array.isArray(plugin.category)
				? plugin.category
				: plugin.category
					? [plugin.category]
					: ["Uncategorized"];

			// if there's a filter, skip plugins that don't match name/desc/commands/category
			if (categoryFilter) {
				const matchesFilter =
					cats.some((c) => normalize(c).includes(categoryFilter)) ||
					pluginName.includes(categoryFilter) ||
					pluginDesc.includes(categoryFilter) ||
					pluginCmds.some((c) => c.includes(categoryFilter));
				if (!matchesFilter) {
					continue;
				}
			}

			for (const cat of cats) {
				if (!categories[cat]) {
					categories[cat] = [];
				}
				categories[cat].push(plugin);
			}
		}

		// remove empty categories and sort
		const sortedCats = Object.keys(categories)
			.filter((c) => categories[c] && categories[c].length > 0)
			.sort((a, b) => a.localeCompare(b));

		// Build menu message
		const lines: string[] = [];
		lines.push(
			`> Type ${usedPrefix}menu <category> to filter by category.`
		);
		for (const cat of sortedCats) {
			lines.push(`╭─── ${cat}`);
			const plugins = (categories[cat] ?? []).sort((a, b) =>
				a.name.localeCompare(b.name)
			);
			for (const plugin of plugins) {
				const cmd = getCommands(plugin)[0] ?? plugin.name;
				lines.push(
					`│ • ${!plugin.ignorePrefix ? usedPrefix : ""}${cmd}`
				);
			}
			lines.push("╰───────────");
		}
		lines.push(`> Type ${usedPrefix}<command> to execute a command.`);
		lines.push(
			`> Type ${usedPrefix}help <command> to get detailed help for a command.`
		);

		await ctx.reply(lines.join("\n").trim());
	},
} satisfies IPlugin;
