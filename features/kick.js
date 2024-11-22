/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["kick", "out"],
	description: "Kick member from group.",
	category: "Group",
	owner: false,
	group: true,
	admin: true,
	hidden: false,
	limit: false,
	private: false,

	execute: async function (m, { sock, isOwner, isBotAdmin, groupMetadata }) {
		if (!isBotAdmin) {
			return m.reply("I'm not an admin");
		}

		const user = m.quoted ? [m.quoted.sender] : m.mentionedJid;
		if (!user || user.length === 0) {
			return m.reply("Please provide a user to kick");
		}

		const groupAdmins = groupMetadata?.participants
			.filter((participant) => participant.admin)
			.map((participant) => participant.id);

		if (user.some((u) => groupAdmins?.includes(u)) && !isOwner) {
			return m.reply("You can't kick an admin");
		}

		// const kickedUser = user.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
		const kickedUser = user.map(
			(u) => u.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
		);

		await sock
			.groupParticipantsUpdate(m.from, kickedUser, "remove")
			.catch(() => {});

		sock.sendMessage(
			m.from,
			{
				text: `Kicked ${kickedUser
					.map((u) => `@${u.replace(/[^0-9]/g, "")}`)
					.join(
						", "
					)} from ${groupMetadata?.subject ?? "this group"}`,
				mentions: kickedUser,
			},
			{ quoted: m.message }
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
