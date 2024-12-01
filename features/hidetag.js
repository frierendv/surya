/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["hidetag", "h"],
	description: "Anonymously tag all members in the group",
	category: "Group",
	admin: true,
	group: true,
	owner: false,
	hidden: false,
	limit: false,
	private: false,

	execute: async function (ctx, { text: _text, groupMetadata }) {
		if (!groupMetadata) {
			return;
		}

		const text = ctx.quoted ? ctx.quoted.text : _text;

		const mentions = groupMetadata.participants
			.map((user) => user.id)
			.filter((id) => id !== ctx.sock.user?.id);

		await ctx.sock.sendMessage(
			ctx.from,
			{
				text,
				mentions,
			},
			{ quoted: ctx.message }
		);
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
