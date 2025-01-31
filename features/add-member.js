/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["add", "invite"],
	description: "Add member to group.",
	category: "Group",
	owner: false,
	group: true,
	admin: true,
	hidden: false,
	limit: false,
	private: false,

	execute: async function (ctx, { text, sock, isBotAdmin, groupMetadata }) {
		if (!isBotAdmin) {
			return ctx.reply("I'ctx not an admin");
		}

		const user = ctx.quoted ? ctx.quoted.sender : text;
		if (!user) {
			return ctx.reply("Please provide a user to add");
		}

		const addedUser = user.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

		const [{ exists }] = await sock
			.onWhatsApp(addedUser)
			.catch(() => [{ exists: false }]);
		if (!exists) {
			return ctx.reply("User not found");
		}

		const [{ status }] = await sock.groupParticipantsUpdate(
			ctx.from,
			[addedUser],
			"add"
		);

		sock.sendMessage(
			ctx.from,
			{
				text: `[${status}] Added ${`@${addedUser.replace(/[^0-9]/g, "")}`} to ${groupMetadata?.subject ?? "this group"}`,
				mentions: [addedUser],
			},
			{ quoted: ctx.message }
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
