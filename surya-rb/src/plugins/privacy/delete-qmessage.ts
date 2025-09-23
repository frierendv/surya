// TODO: in group, delete if quoted message q sender
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "delete-qmessage",
	command: ["delete", "del", "d"],
	category: ["privacy"],
	description: "Delete your private messages sent by the bot.",
	execute: async (ctx, { isAdmin, sock }) => {
		if (!ctx.quoted) {
			return;
		}
		const msg = ctx.quoted;
		/**
		 * Not from bot.
		 * Need to handle phone number properly
		 */
		if (msg.participant !== sock.user?.phoneNumber) {
			return;
		}
		/**
		 * If in group, need to be admin
		 */
		if (ctx.isGroup && !isAdmin) {
			return;
		}
		await msg.delete();
	},
} satisfies IPlugin;
