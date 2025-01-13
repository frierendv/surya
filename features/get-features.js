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

	execute: async function (ctx, { features, text, prefix, command }) {
		if (!text) {
			return ctx.reply(`*Usage*: ${prefix + command} <feature name>`);
		}

		// fix node 18
		const feature = Array.from(features.values()).find((f) =>
			f.command.includes(text.toLowerCase())
		);
		console.debug(feature);

		if (!feature) {
			return ctx.reply("Feature not found.");
		}

		// @ts-ignore
		ctx.reply(readFileSync(feature.filePath, "utf-8"));
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
