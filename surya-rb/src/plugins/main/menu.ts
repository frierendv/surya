import pluginManager from "@libs/plugin-manager";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "display-menu",
	command: ["menu", "help"],
	description: "Display this menu",
	category: ["Main"],
	execute: async (ctx, { prefix }) => {
		const list = pluginManager.list();

		const categoryFilter = ctx.text?.toLowerCase() ?? "";

		const categories: Record<string, IPlugin[]> = {};
		for (const plugin of list) {
			if (plugin.hidden) {
				continue;
			}
			if (plugin.ownerOnly) {
				continue;
			}
			if (plugin.privateChatOnly && ctx.isGroup) {
				continue;
			}
			if (plugin.groupChatOnly && !ctx.isGroup) {
				continue;
			}
			const cats = Array.isArray(plugin.category)
				? plugin.category
				: [plugin.category];
			for (const cat of cats) {
				if (
					categoryFilter &&
					!cat.toLowerCase().includes(categoryFilter) &&
					!plugin.name.toLowerCase().includes(categoryFilter) &&
					!plugin.description
						.toLowerCase()
						.includes(categoryFilter) &&
					!(
						Array.isArray(plugin.command)
							? plugin.command
							: [plugin.command]
					).some((c) => c.toLowerCase().includes(categoryFilter))
				) {
					continue;
				}
				if (!categories[cat]) {
					categories[cat] = [];
				}
				categories[cat].push(plugin);
			}
		}

		let msg = "*Surya-RB*\n\n";
		msg += "Use `.menu <category>` to filter by category.\n\n";
		const sortedCats = Object.keys(categories).sort((a, b) =>
			a.localeCompare(b)
		);
		for (const cat of sortedCats) {
			msg += `━━━━ \`\`\`${cat}\`\`\` ━━━━\n`;
			const plugins = (categories[cat] ?? []).sort((a, b) =>
				a.name.localeCompare(b.name)
			);
			for (const plugin of plugins) {
				const cmd = /** Array.isArray(plugin.customPrefix)
					? plugin.customPrefix[0]
					: plugin.customPrefix || */ Array.isArray(plugin.command)
					? prefix + plugin.command[0]
					: prefix + plugin.command;
				// const cmds = Array.isArray(plugin.command)
				// 	? plugin.command
				// 	: [plugin.command];
				msg += `> *• ${cmd}*\n`;
				msg += `> ${plugin.description || "No description"}\n`;
				const aliases =
					(Array.isArray(plugin.command)
						? plugin.command.slice(1).join(", ")
						: null) || null;
				if (aliases) {
					msg += `> Aliases: ${aliases}\n`;
				}
			}
			msg += "\n";
		}

		await ctx.reply(msg.trim());
	},
} satisfies IPlugin;
