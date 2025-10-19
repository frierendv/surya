import type { GroupMetadata } from "baileys";
import type { WASocket } from "./internals/types";
import type { IMessageContext } from "./message";

export interface IExtraGroupContext {
	/**
	 * Whether the message is from a group chat.
	 */
	isGroup: boolean;
	/**
	 * Whether the sender of the message is an admin of the group.
	 */
	isAdmin: boolean;
	/**
	 * Whether the bot is an admin of the group.
	 */
	isBotAdmin: boolean;
	/**
	 * Metadata about the group if the message is from a group.
	 */
	groupMetadata: GroupMetadata;
}
export interface IExtraContext {
	/**
	 * Whether the sender of the message is set as the owner.
	 */
	isOwner: boolean;
	/**
	 * The prefix used in the message, if any.
	 */
	usedPrefix: string;
	/**
	 * The command used in the message, if any.
	 */
	command: string;
	/**
	 * Socket instance.
	 */
	sock: WASocket;
}
/**
 * Extra message context that supports both private and group chats.
 */
export type ExtraMessageContext = IExtraContext &
	(
		| ({
				isGroup: true;
		  } & IExtraGroupContext)
		| ({
				isGroup: false;
		  } & Partial<IExtraGroupContext>)
	);

/**
 * Backward compatibility type alias.
 */
export type IExtraMessageContext = ExtraMessageContext;

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

	// Normalize key for caching
	const key = Array.isArray(prefix) ? prefix.join("|") : prefix;
	const cached = prefixRegexCache.get(key);
	if (cached) {
		return cached;
	}

	// Build pattern based on type
	const prefixes = Array.isArray(prefix) ? prefix : [prefix];
	const parts = prefixes.filter(Boolean).map(escapeRegex);

	const re = parts.length
		? new RegExp(`^(${parts.join("|")})`)
		: globalPrefix;

	prefixRegexCache.set(key, re);
	return re;
};

/**
 * Extract command from interactive messages (buttons, lists, templates).
 * Returns the selected ID/text in lowercase if found.
 */
const extractCommandFromInteractive = (ctx: IMessageContext): string | null => {
	const message = ctx.message;
	if (!message) {
		return null;
	}

	const interactiveId =
		message.buttonsResponseMessage?.selectedButtonId ||
		message.listResponseMessage?.singleSelectReply?.selectedRowId ||
		message.templateButtonReplyMessage?.selectedId;

	return interactiveId && typeof interactiveId === "string"
		? interactiveId.toLowerCase()
		: null;
};

/**
 * Process text with prefix and update context accordingly.
 */
const processCommandWithPrefix = (
	text: string,
	prefix: string,
	ctx: IMessageContext
): { command: string; usedPrefix: string } => {
	if (!prefix) {
		return { command: text.toLowerCase(), usedPrefix: "" };
	}

	// const command = text.slice(prefix.length).trim().toLowerCase();
	let command: string;
	// Check for interactive message command first
	const interactiveCommand = extractCommandFromInteractive(ctx);
	if (interactiveCommand) {
		command = interactiveCommand;
	} else {
		// Fallback to normal text command extraction
		command = text.slice(prefix.length).trim().toLowerCase();
	}

	ctx.args = ctx.text ? ctx.text.split(/\s+/) : [];

	return { command, usedPrefix: prefix };
};

export const createExtraMessageContext = (
	/**
	 * The message context created by `createMessageContext`.
	 */
	ctx: IMessageContext,
	/** The Baileys socket. */
	sock: WASocket,
	/** The prefix or prefixes to use for command detection. */
	prefix?: string | string[]
): ExtraMessageContext => {
	const isGroup = ctx.from.endsWith("@g.us");

	// Early return if no args
	if (!ctx.args?.[0]) {
		return {
			isGroup,
			isOwner: false,
			isAdmin: false,
			isBotAdmin: false,
			usedPrefix: "",
			command: "",
			sock,
		} as ExtraMessageContext;
	}

	// Get text from interactive message or first arg
	const text = ctx.args[0];

	// Build or use cached prefix regex
	const hasCustomPrefix = Array.isArray(prefix)
		? prefix.length > 0
		: Boolean(prefix);
	const regex = hasCustomPrefix ? buildPrefixRegex(prefix) : globalPrefix;

	// Match prefix
	const match = regex.exec(text);
	const { command, usedPrefix } = match
		? processCommandWithPrefix(text, match[0], ctx)
		: { command: text.toLowerCase(), usedPrefix: "" };

	/**
	 *  We handle group metadata and admin status in surya-rb directly now.
	 *
	 * This is because fetching group metadata all the time for every message
	 * can be inefficient, especially for large groups or high message volumes.
	 * It's better to manage this at a higher level where we can cache results
	 * and reduce redundant network calls.
	 */

	return {
		isGroup,
		isOwner: false,
		isAdmin: false,
		isBotAdmin: false,
		usedPrefix,
		command,
		sock,
	} as ExtraMessageContext;
};
