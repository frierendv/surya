/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["test"],
	description: "test",
	category: "Owner",
	owner: true,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (m, _extras) {
		console.log(_extras);
		m.reply("Test command executed");
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
