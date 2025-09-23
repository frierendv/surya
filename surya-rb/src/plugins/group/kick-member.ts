import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "group-kick-member",
	command: ["kick", "remove"],
	category: ["group"],
	adminOnly: true,
	description: "Kick a member from the group.",
	groupChatOnly: true,
	disabled: true,
	execute: async (ctx, { sock, isBotAdmin, isOwner, groupMetadata }) => {
		if (!isBotAdmin) {
			await ctx.reply("I'm not an admin");
			return;
		}

		const user = ctx.quoted ? [ctx.quoted.participant] : ctx.mentionedJid;
		if (!user || !user.length) {
			await ctx.reply("Please provide a user to kick");
			return;
		}

		const groupAdmins = groupMetadata?.participants
			.filter((participant) => participant.admin)
			.map((participant) => participant.id);

		if (user.some((u: string) => groupAdmins?.includes(u)) && !isOwner) {
			await ctx.reply("You can't kick an admin");
			return;
		}

		const kickedUser = user.map(
			(u: string) => u.replace(/[^0-9]/g, "") + "@s.whatsapp.net"
		);

		await sock
			.groupParticipantsUpdate(ctx.from, kickedUser, "remove")
			.catch(() => {});

		await sock.sendMessage(
			ctx.from,
			{
				text: `Kicked ${kickedUser
					.map((u: string) => `@${u.replace(/[^0-9]/g, "")}`)
					.join(
						", "
					)} from ${groupMetadata?.subject ?? "this group"}`,
				mentions: kickedUser,
			},
			{ quoted: ctx }
		);
	},
} satisfies IPlugin;
