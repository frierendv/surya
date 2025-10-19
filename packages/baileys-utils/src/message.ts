import type { Transform } from "node:stream";
import {
	downloadMediaMessage,
	getContentType,
	jidNormalizedUser,
	normalizeMessageContent,
	proto,
} from "baileys";
import type {
	MessageType,
	MiscMessageGenerationOptions,
	WAMessage,
} from "baileys";
import type { WASocket } from "./internals/types";
import { calculateFileSize, safeString } from "./util";

/**
 * Handler to send a reply and provide helpers to edit/delete that reply.
 */
export type ReplyHandler = (
	/**
	 * The text to reply with.
	 */
	text: string,
	/**
	 * Additional options for the message.
	 */
	opts?: MiscMessageGenerationOptions
) => Promise<{
	/**
	 * Edit the previously sent reply.
	 */
	editReply: (
		/** The new text to edit the reply to. */
		newText: string,
		/** Additional options for the edit message. */
		editOpts?: MiscMessageGenerationOptions
	) => Promise<proto.WebMessageInfo | undefined>;
	/**
	 * Delete the previously sent reply.
	 */
	deleteReply: () => Promise<proto.WebMessageInfo | undefined>;
}>;

/**
 * Basic media metadata and downloader.
 */
export interface IMediaInfo {
	/**
	 * The MIME type of the media.
	 */
	mimetype: string;
	/**
	 * The size of the media in bytes.
	 */
	size: number;
	/**
	 * Download the media content as a buffer or stream.
	 */
	download: <T extends "stream" | "buffer" = "buffer">(
		output?: T
	) => Promise<T extends "stream" ? Transform : Buffer<ArrayBufferLike>>;
}

/**
 * Metadata for a quoted message (context info + extracted helpers).
 */
export interface QuotedMessageMeta extends proto.IContextInfo {
	/**
	 * The sender of the quoted message.
	 */
	participant: string;
	/**
	 * Extracted text of the quoted message.
	 */
	text: string;
	/**
	 * Media info for the quoted message, if present.
	 */
	media: IMediaInfo | null;
}

/**
 * Standard actions available on a message or quoted message.
 */
export interface IMessageActions {
	/**
	 * Reply to the message or quoted message.
	 */
	reply: ReplyHandler;
	/**
	 * React to the message (empty string removes reaction).
	 */
	react: (text: string) => Promise<proto.WebMessageInfo | undefined>;
	/**
	 * Forward the message to another chat JID.
	 */
	forward: (
		/** The destination chat JID to forward the message to. */
		jid: string,
		/** Additional options for the forward message. */
		opts?: MiscMessageGenerationOptions
	) => Promise<proto.WebMessageInfo | undefined>;
	/**
	 * Delete the message, if permitted.
	 */
	delete: () => Promise<proto.WebMessageInfo | undefined>;
}

/**
 * Extracted and normalized metadata for an incoming message.
 */
export interface IMessageMeta extends IMessageActions {
	/**
	 * Chat **JID/LID** from which the message originated.
	 */
	from: string;
	/**
	 * The actual sender **JID/LID** (participant in groups or chat JID in DMs).
	 */
	sender: string;
	/**
	 * Sender display name (push name) or business name.
	 */
	pushName?: string | null;
	/**
	 * The normalized extracted text for easier processing.
	 */
	text: string;
	/**
	 * Arguments/words in the text split by spaces.
	 */
	args: string[];
	/**
	 * List of mentioned JIDs in the message, if any.
	 */
	mentionedJid: string[];
	/**
	 * List of group mentions in the message, if any.
	 */
	groupMentions: proto.IGroupMention[];
	/**
	 * Media metadata if the message contains media.
	 */
	media: IMediaInfo | null;
	/**
	 * If the message quotes another message, this contains quoted message metadata + actions.
	 */
	quoted: (QuotedMessageMeta & IMessageActions) | null;
}

/**
 * Full message context including raw WAMessage fields and normalized metadata/actions.
 */
export interface IMessageContext extends IMessageMeta, WAMessage {}

export const getMessageType = (
	message?: proto.IMessage | null
): NoInfer<MessageType> | null => {
	if (!message) {
		return null;
	}

	// Unwrap ephemeral wrapper if present
	const inner = message.ephemeralMessage?.message ?? message;
	return getContentType(inner) as MessageType;
};
/**
 * Extract the most relevant text from a proto.IMessage.
 */
export const getMessageText = (msg?: proto.IMessage | null): string => {
	if (!msg) {
		return "";
	}

	// Unwrap ephemeral wrapper if present
	const inner = (msg.ephemeralMessage?.message ?? msg) as any;
	if (inner.conversation) {
		return inner.conversation;
	}
	const messageType = getMessageType(inner)!;

	const candidates = [
		inner?.[messageType]?.text,
		inner?.[messageType]?.caption,
		inner?.[messageType]?.selectedDisplayText,
		inner?.[messageType]?.selectedDisplayText,
		inner?.[messageType]?.body?.text,
	];

	for (const c of candidates) {
		if (typeof c === "string") {
			const s = c.trim();
			if (s.length) {
				return s;
			}
		} else if (c != null) {
			const s = String(c).trim();
			if (s.length) {
				return s;
			}
		}
	}

	return "";
};

/**
 * Build MediaInfo from a proto.IMessage if it contains media.
 */
export const createMediaInfo = (
	message?: proto.IMessage | null
): IMediaInfo | null => {
	const inner =
		message?.ephemeralMessage?.message ||
		message?.buttonsMessage ||
		message?.templateMessage?.hydratedTemplate ||
		message;
	const content =
		inner?.documentMessage ||
		inner?.imageMessage ||
		inner?.videoMessage ||
		message?.audioMessage ||
		message?.stickerMessage;
	if (!content) {
		return null;
	}

	const downloadMessage = async (output = "buffer") => {
		return downloadMediaMessage(
			{ message } as proto.IWebMessageInfo,
			output === "stream" ? "stream" : "buffer",
			{}
		);
	};

	return {
		mimetype: content.mimetype! || "application/octet-stream",
		size: calculateFileSize(content.fileLength || 0),
		download: downloadMessage as IMediaInfo["download"],
	};
};

/**
 * Build quoted message metadata (if the message quotes another).
 */
export const createQuotedMessage = (
	contextInfo?: proto.IContextInfo | null
): QuotedMessageMeta | null => {
	// Unwrap ephemeral wrapper if present
	const quotedMessage = normalizeMessageContent(contextInfo?.quotedMessage);
	if (!quotedMessage) {
		return null;
	}

	const media = createMediaInfo(quotedMessage);
	const text = getMessageText(quotedMessage);

	return {
		text,
		media,
		...contextInfo,
		participant: contextInfo!.participant as string,
	};
};

/**
 * Create a reply handler that sends a message and returns edit/delete capabilities.
 */
const createReplyHandler = (
	sock: WASocket,
	remoteJid: string,
	quotedMessage:
		| WAMessage
		| { message: proto.IMessage; key: proto.IMessageKey }
): ReplyHandler => {
	const createHandlers = (
		sock: WASocket,
		remoteJid: string,
		messageKey: proto.IMessageKey
	) => {
		const editReply = (newText: string, editOpts = {}) =>
			sock.sendMessage(remoteJid, {
				text: newText,
				edit: messageKey,
				...editOpts,
			});

		const deleteReply = () =>
			sock.sendMessage(remoteJid, { delete: messageKey });

		return { editReply, deleteReply };
	};

	return async (text: string, replyOpts = {}) => {
		const replyRes = await sock.sendMessage(
			remoteJid,
			{ text, ...replyOpts },
			{ quoted: quotedMessage }
		);
		if (!replyRes) {
			throw new Error("Failed to send reply message");
		}

		return createHandlers(sock, remoteJid, replyRes.key);
	};
};

/**
 * Create message actions (reply, react, forward, delete) for a given message key.
 */
const createMessageActions = (
	sock: WASocket,
	remoteJid: string,
	messageKey: proto.IMessageKey,
	message: proto.IMessage,
	quotedMessage?:
		| WAMessage
		| { message: proto.IMessage; key: proto.IMessageKey }
): IMessageActions => {
	const reply = quotedMessage
		? createReplyHandler(sock, remoteJid, quotedMessage)
		: createReplyHandler(sock, remoteJid, {
				message,
				key: messageKey,
			} as WAMessage);

	const react = (text: string) =>
		sock.sendMessage(remoteJid, { react: { text, key: messageKey } });

	const forward = (jid: string, opts?: MiscMessageGenerationOptions) =>
		sock.sendMessage(
			jid,
			{
				forward: {
					message,
					key: { ...messageKey, remoteJid },
				},
			},
			opts
		);

	const deleteMsg = () => sock.sendMessage(remoteJid, { delete: messageKey });

	return { reply, react, forward, delete: deleteMsg };
};

/**
 * Construct a {MessageContext} that contains both the raw WAMessage and
 * convenient normalized metadata + helper actions.
 */
export const createMessageContext = (
	msg: WAMessage,
	sock: WASocket
): IMessageContext => {
	const remoteJid = msg.key.remoteJid!;
	const inner = normalizeMessageContent(msg.message);
	const messageType = getMessageType(inner)!;
	const media = createMediaInfo(inner);
	const myUserId = sock.user?.id;

	// Create message actions for the main message
	const messageActions = createMessageActions(
		sock,
		remoteJid,
		msg.key,
		msg.message!
	);

	const contextInfo = (inner?.[messageType] as any)
		?.contextInfo as proto.IContextInfo;
	const quoted = createQuotedMessage(contextInfo);

	if (quoted) {
		// Build quoted message key
		const qId = contextInfo?.stanzaId;
		const qParticipant = contextInfo?.participant;
		const qFromMe = qParticipant === myUserId;
		const qMKey: proto.IMessageKey = {
			id: qId!,
			fromMe: qFromMe!,
			participant: qParticipant!,
			remoteJid,
		};

		const quotedPayload = {
			message: normalizeMessageContent(contextInfo?.quotedMessage)!,
			key: qMKey,
		};

		// Create message actions for the quoted message
		const quotedActions = createMessageActions(
			sock,
			remoteJid,
			qMKey,
			normalizeMessageContent(contextInfo?.quotedMessage)!,
			quotedPayload
		);

		// Override delete for quoted messages to handle participant
		const deleteQuoted = () => {
			if (!qId || !qParticipant) {
				return;
			}
			return sock.sendMessage(remoteJid, {
				delete: {
					...qMKey,
					...(!qFromMe ? { participant: qParticipant } : {}),
				},
			});
		};

		Object.assign(quoted, { ...quotedActions, delete: deleteQuoted });
	}

	const sender = jidNormalizedUser(
		remoteJid.endsWith("@g.us") ? msg.key.participant! : remoteJid
	);
	const text = getMessageText(inner);
	const args = text.split(/\s+/).filter((a) => a.length);

	// reference to msg
	const fullMsg: WAMessage = new Proxy(msg, {
		get(target, prop: keyof WAMessage) {
			if (prop in target) {
				return target[prop];
			}
			return undefined;
		},
	});

	return {
		from: remoteJid,
		sender,
		pushName: safeString(msg.verifiedBizName || msg.pushName) as string,
		text,
		args,
		mentionedJid: contextInfo?.mentionedJid?.map(jidNormalizedUser) || [],
		groupMentions: contextInfo?.groupMentions || [],
		media,
		quoted: quoted as IMessageMeta["quoted"],
		...fullMsg,
		...messageActions,
	};
};
