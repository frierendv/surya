/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["menu"],
	description: "Show this menu",
	category: "Main",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	generateCommandMessage(command, isOwner, isAdmin, prefix) {
		let _prefix = command.ignorePrefix ? "" : prefix;
		const cmdText = Array.isArray(command.customPrefix)
			? command.customPrefix[0]
			: command.customPrefix || Array.isArray(command.command)
				? _prefix + command.command[0]
				: _prefix + command.command;

		let message = "";
		// command
		message +=
			((command.owner && !isOwner) || (command.admin && !isAdmin)
				? `- ~${cmdText}~`
				: `- *${cmdText}*`) + "\n";

		// description
		message += `> ${command.description}\n`;

		// aliases
		const aliases =
			(Array.isArray(command.command)
				? command.command.slice(1).join(", ")
				: null) || null;
		if (aliases) {
			message += `> Aliases: ${aliases}\n`;
		}
		return message;
	},

	groupFeaturesByCategory(features) {
		const filtered = Object.fromEntries(features.entries());
		return Object.entries(filtered).reduce((acc, [_, value]) => {
			const category = value.category?.trim() || "Unknown";
			acc[category] = acc[category] || [];
			acc[category].push(value);
			return acc;
		}, {});
	},

	execute: async function (
		ctx,
		{ text, prefix, isOwner, isAdmin, features: _features }
	) {
		const categoryFilter = text?.toLowerCase() ?? "";
		const features = this.groupFeaturesByCategory(_features);
		const categories = Object.keys(features).sort();

		let message = "";
		for (const category of categories) {
			if (categoryFilter && category?.toLowerCase() !== categoryFilter) {
				continue;
			}
			message += `━━━━ \`\`\`${category}\`\`\` ━━━━\n`;

			for (const feature of features[category]) {
				message += this.generateCommandMessage(
					feature,
					isOwner,
					isAdmin,
					prefix
				);
			}
		}

		if (!message && categoryFilter) {
			message = `No command found for category \`${categoryFilter}\``;
		}

		ctx.reply(message.trim());
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
