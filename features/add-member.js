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

	execute: async function (
		m,
		{ text, sock, isOwner, isBotAdmin, groupMetadata }
	) {
		if (!isBotAdmin) {
			return m.reply("I'm not an admin");
		}

		const user = m.quoted ? m.quoted.sender : text;
		if (!user) {
			return m.reply("Please provide a user to add");
		}

		const addedUser = user.replace(/[^0-9]/g, "") + "@s.whatsapp.net";

		const [{ exists }] = await sock
			.onWhatsApp(addedUser)
			.catch(() => [{ exists: false }]);
		if (!exists) {
			return m.reply("User not found");
		}

		await sock
			.groupParticipantsUpdate(m.from, [addedUser], "add")
			.catch(() => {});

		sock.sendMessage(
			m.from,
			{
				text: `Added ${`@${addedUser.replace(/[^0-9]/g, "")}`} to ${groupMetadata?.subject ?? "this group"}`,
				mentions: [addedUser],
			},
			{ quoted: m.message }
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
