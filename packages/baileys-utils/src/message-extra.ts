import type { GroupMetadata, WASocket } from "baileys";
import type { IMessageContext } from "./message";

export interface IExtraMessageContext {
	/**
	 * Metadata about the group if the message is from a group.
	 */
	groupMetadata?: GroupMetadata | null;
	/**
	 * Whether the sender of the message is set as the owner.
	 */
	isOwner?: boolean;
	/**
	 * Whether the sender of the message is an admin of the group.
	 */
	isAdmin?: boolean;
	/**
	 * Whether the bot is an admin of the group.
	 */
	isBotAdmin?: boolean;
	/**
	 * The prefix used in the message, if any.
	 */
	prefix: string;
	/**
	 * The command used in the message, if any.
	 */
	command: string;
}

const globalPrefix = /^([!/#$%.?&;,:`´¨^*+~=<>|])/;

export const createExtraMessageContext = async (
	ctx: IMessageContext,
	sock: WASocket
): Promise<IExtraMessageContext> => {
	let prefix = "";
	let command = "";
	if (ctx.text) {
		const text = ctx.text;
		const match = globalPrefix.exec(text);
		if (match) {
			prefix = match[0];
			command = text.slice(prefix.length).trim().split(" ")[0] || "";
			ctx.text = text.slice(prefix.length + command.length).trim();
			ctx.args = ctx.text.split(" ").filter((v) => v);
		}
	}

	// non-group contexts
	if (!ctx.isGroup) {
		return {
			groupMetadata: null,
			isAdmin: false,
			isBotAdmin: false,
			prefix,
			command,
		};
	}

	const groupMetadata = await sock.groupMetadata(ctx.from);
	const participants = groupMetadata?.participants ?? [];
	const senderId = ctx.sender;
	const botId = sock.user?.id ?? "";

	// avoids creating intermediate arrays.
	let isAdmin = false;
	let isBotAdmin = false;

	for (const p of participants) {
		if (!isAdmin && p.id === senderId && p.admin) {
			isAdmin = true;
		}
		if (!isBotAdmin && botId && p.id === botId && p.admin) {
			isBotAdmin = true;
		}
		if (isAdmin && isBotAdmin) {
			break;
		}
	}

	return {
		groupMetadata,
		isAdmin,
		isBotAdmin,
		prefix,
		command,
	};
};
