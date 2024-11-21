/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["del", "delete"],
	description: "Delete bot messages",
	category: "Tools",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (m, { isGroup, isAdmin, isBotAdmin, isOwner }) {
		if (!m.quoted) {
			return;
		}
		// if is group and bot admin anf is admin or owner
		// const shouldDelete = isGroup && isBotAdmin && (isAdmin || isOwner);
		if (this.shouldDelete(isGroup, isAdmin, isBotAdmin, isOwner)) {
			await m.quoted.delete();
			return;
		}
		// if is bot message or owner
		if (m.quoted?.message?.key?.fromMe || isOwner) {
			await m.quoted.delete();
			return;
		}
	},
	shouldDelete: function (
		/** @type {boolean} */ isGroup,
		/** @type {boolean} */ isAdmin,
		/** @type {boolean} */ isBotAdmin,
		/** @type {boolean} */ isOwner
	) {
		return isGroup && isBotAdmin && (isAdmin || isOwner);
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
