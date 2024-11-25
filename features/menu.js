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

	execute: async function (
		ctx,
		{ text, prefix, isOwner, isAdmin, features: _features }
	) {
		const c = text?.toLowerCase() ?? "";

		const filterded = Object.fromEntries(_features.entries());
		const features = Object.entries(filterded).reduce((acc, [_, value]) => {
			const category = value.category?.trim() || "Unknown";
			acc[category] = acc[category] || [];
			acc[category].push(value);
			return acc;
		}, {});
		const categories = Object.keys(features).sort();
		let message = "";
		for (const category of categories) {
			if (c && category?.toLowerCase() !== c) {
				continue;
			}
			message += `━━━━ \`\`\`${category}\`\`\` ━━━━\n`;

			for (const feature of features[category]) {
				let _prefix = feature.ignorePrefix ? "" : prefix;
				const command = Array.isArray(feature.customPrefix)
					? feature.customPrefix[0]
					: feature.customPrefix || Array.isArray(feature.command)
						? _prefix + feature.command[0]
						: _prefix + feature.command;

				// command
				message +=
					((feature.owner && !isOwner) || (feature.admin && !isAdmin)
						? `- ~${command}~`
						: `- *${command}*`) + "\n";

				// description
				message += `> ${feature.description}\n`;

				// aliases
				const aliases =
					(Array.isArray(feature.command)
						? feature.command.slice(1).join(", ")
						: null) || null;
				if (aliases) {
					message += `> Aliases: ${aliases}\n`;
				}
			}
		}

		// if no command found for category
		if (!message && c) {
			message = `No command found for category \`${c}\``;
		}

		// send the message
		ctx.reply(message.trim());
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
