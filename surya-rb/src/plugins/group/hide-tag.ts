import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "group-hide-tag",
	command: ["hidetag", "tagall", "h"],
	category: ["group"],
	groupChatOnly: true,
	adminOnly: true,
	description: "Hide tag all members in the group.",
	execute: async (ctx, { sock, isOwner, groupMetadata }) => {
		const text = ctx.text || (ctx.quoted && ctx.quoted.text);
		if (!text) {
			await ctx.reply("Please provide a message to send");
			return;
		}

		const groupMembers = groupMetadata?.participants.map(
			(participant) => participant.id
		);

		if (!groupMembers || !groupMembers.length) {
			await ctx.reply("Failed to get group members");
			return;
		}

		if (groupMembers.length > 256 && !isOwner) {
			await ctx.reply(
				"Group is too large, only owner can use this command"
			);
			return;
		}
		// try to filter out sender and the bot itself
		const botNumber = sock.user?.id;
		const filteredMembers = groupMembers.filter(
			(member) =>
				!member.includes("g.us") &&
				member !== botNumber &&
				member !== ctx.sender
		);

		await sock.sendMessage(
			ctx.from,
			{
				text,
				mentions: filteredMembers,
			},
			{ quoted: ctx }
		);
	},
} satisfies IPlugin;
