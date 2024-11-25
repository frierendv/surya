import { readFileSync } from "fs";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["getfeature", "getfeat", "gf"],
	description: "Get feature.",
	category: "Owner",
	owner: true,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (m, { features, text, prefix, command }) {
		if (!text) {
			return m.reply(`*Usage*: ${prefix + command} <feature name>`);
		}

		const feature = features
			.values()
			.find((f) => f.command.includes(text.toLowerCase()));

		if (!feature) {
			return m.reply("Feature not found.");
		}

		// @ts-ignore
		m.reply(readFileSync(feature.filePath, "utf-8"));
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
