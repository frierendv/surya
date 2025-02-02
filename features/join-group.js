/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["join", "join-group"],
	description: "Join a group using an invite link.",
	category: "Group",
	owner: false,
	group: false,
	admin: false,
	hidden: false,
	limit: false,
	private: false,

	execute: async function (ctx, { args }) {
		const [groupInviteCode] =
			args[0].match(
				new RegExp(
					"(?<=https://chat.whatsapp.com/|https://invite.whatsapp.com/)[a-zA-Z0-9]+"
				)
			) || [];
		if (!groupInviteCode) {
			return ctx.reply(
				"The provided group link is invalid. Please ensure the entire link is pasted correctly."
			);
		}

		const groupInfo = await ctx.sock
			.groupGetInviteInfo(groupInviteCode)
			.catch(() => null);
		if (!groupInfo) {
			return ctx.reply(
				"Unable to retrieve group information. Please verify the link is correct."
			);
		}

		const alreadyInGroup = await ctx.sock
			.groupFetchAllParticipating()
			.then((groups) =>
				Object.keys(groups).some(
					(group) => groups[group].id === groupInfo.id
				)
			);
		if (alreadyInGroup) {
			return ctx.reply("Already a member of this group.");
		}

		const { size, participants, subject, isCommunity, joinApprovalMode } =
			groupInfo;
		if (isCommunity) {
			return ctx.reply(
				"Community groups are not supported. Only regular group chats are allowed."
			);
		}

		const groupSize = size || participants.length;
		if (groupSize < 20) {
			return ctx.reply(
				"The group must have more than 20 members to join."
			);
		}

		await ctx.sock.groupAcceptInvite(groupInviteCode);

		return ctx.reply(
			`Successfully joined the group: ${subject}. ${
				(joinApprovalMode &&
					"*Please note that admin approval is required.+") ||
				""
			}`
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
