import type { GroupMetadata } from "baileys";
import { WASocket } from "./internals/types";
import type { IMessageContext } from "./message";

export interface IExtraMessageContext<IsGroup extends boolean = boolean> {
	/**
	 * Whether the message is from a group chat.
	 */
	isGroup: IsGroup;
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
	usedPrefix: string;
	/**
	 * The command used in the message, if any.
	 */
	command: string;
	/**
	 * Metadata about the group if the message is from a group.
	 */
	groupMetadata: IsGroup extends true ? GroupMetadata : null;
	/**
	 * Socket instance.
	 */
	sock: WASocket;
}

const globalPrefix = /^([!./])/;

/**
 * Escape special regex characters in a string.
 */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Cache compiled prefix regexes to avoid rebuilding them on every message.
 * Key is a normalized string representation of the prefix(s).
 */
const prefixRegexCache = new Map<string, RegExp>();

/**
 * Build (and cache) a RegExp that matches provided prefix.
 */
const buildPrefixRegex = (prefix?: string | string[]): RegExp => {
	if (!prefix || (Array.isArray(prefix) && prefix.length === 0)) {
		return globalPrefix;
	}
	const key = Array.isArray(prefix)
		? `arr:${prefix.join("|")}`
		: `str:${prefix}`;
	const cached = prefixRegexCache.get(key);
	if (cached) {
		return cached;
	}

	let pattern: string;
	if (Array.isArray(prefix)) {
		// filter out empty entries (defensive) and escape each one
		const parts = prefix.filter(Boolean).map(escapeRegex);
		pattern = parts.length ? `^(${parts.join("|")})` : ""; // empty pattern indicates fallback to globalPrefix
	} else {
		pattern = prefix ? `^(${escapeRegex(prefix)})` : "";
	}

	const re = pattern ? new RegExp(pattern) : globalPrefix;
	prefixRegexCache.set(key, re);
	return re;
};

export const createExtraMessageContext = async (
	/**
	 * The message context created by `createMessageContext`.
	 */
	ctx: IMessageContext,
	/** The Baileys socket. */
	sock: WASocket,
	/** The prefix or prefixes to use for command detection. */
	prefix?: string | string[]
): Promise<IExtraMessageContext> => {
	const isGroup = ctx.from.endsWith("@g.us");
	const fbObj: IExtraMessageContext = {
		isGroup,
		isOwner: false,
		isAdmin: false,
		isBotAdmin: false,
		usedPrefix: "",
		command: "",
		groupMetadata: null,
		sock,
	};
	if (!ctx.args?.[0]) {
		return fbObj;
	}
	const [text] = ctx.args;

	// decide whether to use a custom prefix or the global default
	const hasCustomPrefix = Array.isArray(prefix)
		? prefix.length > 0
		: Boolean(prefix);
	const regex = hasCustomPrefix ? buildPrefixRegex(prefix) : globalPrefix;

	const match = regex.exec(text);
	fbObj.command = text.toLowerCase();

	if (match) {
		fbObj.usedPrefix = match[0];
		// use ctx.text so that we strip the actual message text (not the tokenized arg)
		fbObj.command = (
			ctx.text.slice(fbObj.usedPrefix.length).trim().split(/\s+/)[0] || ""
		).toLowerCase();
	} else {
		fbObj.usedPrefix = "";
	}

	// non-group contexts
	if (!isGroup) {
		return fbObj;
	}

	const groupMetadata = await sock.groupMetadata(ctx.from);
	const participants = groupMetadata?.participants ?? [];
	const senderId = ctx.sender;
	const botId = sock.user?.id ?? "";

	// Avoid creating intermediate arrays by scanning participants once.
	fbObj.groupMetadata = groupMetadata;
	fbObj.isAdmin = false;
	fbObj.isBotAdmin = false;

	for (const p of participants) {
		const pIds = [p.phoneNumber, p.id, p.lid].filter(Boolean);
		if (pIds.includes(senderId)) {
			if (p.admin === "admin" || p.admin === "superadmin") {
				fbObj.isAdmin = true;
			}
		}
		if (pIds.includes(botId)) {
			if (p.admin === "admin" || p.admin === "superadmin") {
				fbObj.isBotAdmin = true;
			}
		}
		if (fbObj.isAdmin && fbObj.isBotAdmin) {
			break;
		}
	}

	return fbObj;
};
