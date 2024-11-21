import { readFileSync } from "fs";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["getfeature", "getplug", "gp"],
	description: "Grab feature.",
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

		let found = false;

		for (const key in features) {
			if (key === text || features[key].command.includes(text)) {
				found = features[key].filePath;
				break;
			}
		}

		if (!found) {
			const featureList = Object.keys(features)
				.sort()
				.map((name, index) => `${index + 1}. ${name}`)
				.join("\n");
			return m.reply(
				`'${text}' not found\n\nFound this:\n${featureList}`
			);
		}

		// @ts-ignore
		m.reply(readFileSync(found, "utf-8"));
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
