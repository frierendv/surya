import { exec } from "child_process";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["$"],
	customPrefix: ["$"],
	description: "Call shell commands",
	category: "Owner",
	owner: true,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (m, { text }) {
		try {
			const result = await new Promise((resolve, reject) => {
				exec(text, (error, stdout, stderr) => {
					if (error) {
						reject(error);
					} else {
						resolve(stdout || stderr);
					}
				});
			});
			m.reply(`${result}`.trim());
		} catch (error) {
			m.reply(`${error}`.trim());
		}
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
