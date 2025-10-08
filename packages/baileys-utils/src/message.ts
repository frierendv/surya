import { downloadMediaMessage, jidNormalizedUser, proto } from "baileys";
import type { MiscMessageGenerationOptions, WAMessage } from "baileys";
import { WASocket } from "./internals/types";
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
	 * The size of the media (human readable).
	 */
	size: number;
	/**
	 * Download the media content as Buffer/Uint8Array.
	 */
	download: () => Promise<Uint8Array | Buffer>;
}

/**
 * Metadata for a quoted message (context info + extracted helpers).
 */
export interface QuotedMessageMeta {
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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IMessageContext extends IMessageMeta {}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface IMessageContext extends WAMessage {}

/**
 * Extract the most relevant text from a proto.IMessage.
 */
export const getMessageText = (msg?: proto.IMessage | null): string => {
	if (!msg) {
		return "";
	}

	// Unwrap ephemeral wrapper if present
	const inner = msg.ephemeralMessage?.message ?? msg;

	const candidates: (string | undefined | null)[] = [
		inner.conversation,
		inner.extendedTextMessage?.text,
		inner.imageMessage?.caption,
		inner.videoMessage?.caption,
		inner.documentMessage?.caption,
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
	const content =
		message?.documentMessage ||
		message?.imageMessage ||
		message?.videoMessage ||
		message?.audioMessage ||
		message?.stickerMessage;
	if (!content) {
		return null;
	}

	const downloadMessage = async () => {
		const buffer = await downloadMediaMessage(
			{ message } as proto.IWebMessageInfo,
			"buffer",
			{}
		);
		return buffer;
	};

	return {
		mimetype: content.mimetype! || "application/octet-stream",
		size: calculateFileSize(content.fileLength!),
		download: downloadMessage,
	};
};

/**
 * Build quoted message metadata (if the message quotes another).
 */
export const createQuotedMessage = (
	message?: proto.IMessage | null
): QuotedMessageMeta | null => {
	// Unwrap ephemeral wrapper if present
	const inner = message?.ephemeralMessage?.message ?? message;
	const contextInfo = inner?.extendedTextMessage?.contextInfo;
	const quotedMessage = contextInfo?.quotedMessage;
	if (!quotedMessage) {
		return null;
	}

	const media = createMediaInfo(quotedMessage);
	const text = getMessageText(quotedMessage);

	return {
		participant: contextInfo.participant as string,
		text,
		media,
	};
};

/**
 * Construct a {MessageContext} that contains both the raw WAMessage and
 * convenient normalized metadata + helper actions.
 */
export const createMessageContext = (
	msg: WAMessage,
	sock: WASocket
): IMessageContext => {
	const remoteJid = (msg.key.remoteJid || msg.key.remoteJidAlt)!;
	const media = createMediaInfo(msg.message);
	const myUserId = sock.user?.id;

	const sendReply: ReplyHandler = async (text: string, replyOpts = {}) => {
		const replyRes = await sock.sendMessage(
			remoteJid,
			{ text, ...replyOpts },
			{ quoted: msg }
		);
		if (!replyRes) {
			throw new Error("Failed to send reply message");
		}

		const editReply = (newText: string, editOpts = {}) =>
			sock.sendMessage(remoteJid, {
				text: newText,
				edit: replyRes.key,
				...editOpts,
			});

		const deleteReply = () =>
			sock.sendMessage(remoteJid, { delete: replyRes.key });

		return { editReply, deleteReply };
	};

	const sendReaction = (text: string) =>
		sock.sendMessage(remoteJid, { react: { text, key: msg.key } });

	const forwardTo = (jid: string, opts?: MiscMessageGenerationOptions) =>
		sock.sendMessage(jid, { forward: msg }, opts);

	const deleteMessage = () =>
		sock.sendMessage(remoteJid, { delete: msg.key });

	const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
	const quoted = createQuotedMessage(msg.message);
	if (quoted) {
		// quoted context
		const qId = contextInfo?.stanzaId;
		const qParticipant = contextInfo?.participant;
		const qFromMe = qParticipant === myUserId;

		const replyQuoted: ReplyHandler = async (
			text: string,
			replyOpts = {}
		) => {
			const quotedPayload: any = {
				...msg,
				key: {
					id: qId,
					fromMe: qFromMe,
					participant: qParticipant,
				},
				...quoted,
			};

			const replyRes = await sock.sendMessage(
				remoteJid,
				{ text, ...replyOpts },
				{ quoted: quotedPayload }
			);
			if (!replyRes) {
				throw new Error("Failed to send quoted reply");
			}

			const editReply = (newText: string, editOpts = {}) =>
				sock.sendMessage(remoteJid, {
					text: newText,
					edit: replyRes.key,
					...editOpts,
				});

			const deleteReply = () =>
				sock.sendMessage(remoteJid, { delete: replyRes.key });

			return { editReply, deleteReply };
		};
		Object.assign(quoted, { reply: replyQuoted });

		const reactQuoted = (text: string) =>
			sock.sendMessage(remoteJid, {
				react: {
					text,
					key: {
						id: qId,
						fromMe: qFromMe,
						participant: qParticipant,
						remoteJid,
					},
				},
			});
		Object.assign(quoted, { react: reactQuoted });

		const forwardQuoted = (jid: string) =>
			sock.sendMessage(jid, {
				forward: {
					...msg,
					key: {
						id: qId,
						fromMe: qFromMe,
						participant: qParticipant,
						remoteJid,
					},
					...quoted,
				},
			});
		Object.assign(quoted, { forward: forwardQuoted });

		const deleteQuoted = () => {
			if (!qId || !qParticipant) {
				return;
			}
			return sock.sendMessage(remoteJid, {
				delete: {
					id: qId,
					fromMe: qFromMe,
					remoteJid,
				},
			});
		};
		Object.assign(quoted, { delete: deleteQuoted });
	}

	const sender = jidNormalizedUser(
		(remoteJid.endsWith("@g.us")
			? msg.key.participantAlt || msg.key.participant
			: remoteJid) ?? undefined
	);
	const text = getMessageText(msg.message);
	const args = text.split(/\s+/).filter((a) => a.length);

	return {
		from: remoteJid,
		sender,
		pushName: safeString(msg.verifiedBizName || msg.pushName),
		text,
		args,
		mentionedJid: contextInfo?.mentionedJid?.map(jidNormalizedUser) || [],
		groupMentions: contextInfo?.groupMentions || [],
		media,
		quoted: quoted as IMessageMeta["quoted"],
		...msg,
		reply: sendReply,
		react: sendReaction,
		forward: forwardTo,
		delete: deleteMessage,
	};
};
