/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["=>"],
	ignorePrefix: true,
	description: "Evaluate a JavaScript code",
	category: "Owner",
	owner: true,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (
		m,
		// eslint-disable-next-line no-unused-vars
		{ text, sock, groupMetadata, store, db, api, features }
	) {
		try {
			let result = await eval(text);
			if (typeof result === "object") {
				result = JSON.stringify(result, null, 2);
			}
			m.reply(`${result}`.trim());
		} catch (error) {
			m.reply(`Error: ${error.message}`);
		}
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
