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
		const _user =
			ctx?.quoted?.sender || ctx.mentionedJid[0] || text
				? text.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
				: null;
		if (!_user) {
			return ctx.reply("Reply or tag a user");
		}
		const user = db.users.set(_user);
		user.banned = true;

		await sock.sendMessage(
			ctx.from,
			{
				text: `Banned @${_user.replace(/[^0-9]/g, "")}`,
				mentions: [_user],
			},
			{ quoted: ctx.message }
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
