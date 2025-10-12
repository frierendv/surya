import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "delete-qmessage",
	command: ["delete", "del", "d"],
	category: ["privacy"],
	description: "Delete your private messages sent by the bot.",
	execute: async (ctx, { isAdmin, isGroup, sock }) => {
		const quoted = ctx.quoted;
		if (!quoted) {
			return;
		}

		const botIds = [sock.user?.phoneNumber, sock.user?.lid].filter(Boolean);
		const isBotMessage = botIds.includes(quoted.participant);

		// Always allow deleting bot's own message
		if (isBotMessage) {
			await quoted.delete();
			return;
		}

		// Allow deleting any quoted message in a group if user is admin
		if (isGroup && isAdmin) {
			await quoted.delete();
		}
	},
} satisfies IPlugin;
