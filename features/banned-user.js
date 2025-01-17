/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["ban", "banned"],
	description: "Banned user.",
	category: "Owner",
	owner: true,
	group: false,
	admin: false,
	hidden: false,
	limit: false,
	private: false,

	execute: async function (ctx, { sock, db, text }) {
		const jid =
			ctx?.quoted?.sender ||
			ctx.mentionedJid[0] ||
			text.replace(/[^0-9]/g, "") + "@s.whatsapp.net";
		const user = db.users.get(jid);

		if (!user) {
			return ctx.reply("Reply or tag a user");
		}
		user.banned = true;

		await sock.sendMessage(
			ctx.from,
			{
				text: `Banned @${jid.replace(/[^0-9]/g, "")}`,
				mentions: [jid],
			},
			{ quoted: ctx.message }
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
