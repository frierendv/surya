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

	execute: async function (ctx, _extras) {
		ctx.reply("Test command executed");
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
