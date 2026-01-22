import { Readable } from "stream";
import {
	convertAudio,
	getStreamType,
	isBuffer,
	isDataUrl,
	isLocalFile,
	streamFromBuffer,
} from "@surya/ffmpeg-utils";
import type { AnyMediaMessageContent } from "baileys";
import { fetch } from "undici";
import type { SendFile, SendFileOptions, WASocket } from "./types";

let cachedFs: typeof import("fs") | undefined;

const downloadFile = async (content: any): Promise<Readable> => {
	if (isBuffer(content)) {
		return streamFromBuffer(content);
	}

	if (isDataUrl(content)) {
		const base64 = content.split(",")[1] || "";
		return streamFromBuffer(Buffer.from(base64, "base64"));
	}

	if (isLocalFile(content)) {
		if (!cachedFs) {
			cachedFs = await import("fs");
		}
		return cachedFs.createReadStream(content);
	}

	if (typeof content === "string" && /^https?:\/\//.test(content)) {
		const res = await fetch(content, {
			method: "GET",
			headers: { "accept-encoding": "identity" },
		});
		if (res.ok && res.body) {
			return Readable.fromWeb(res.body, { highWaterMark: 4096 });
		}
		throw new Error("Failed to download file: " + res.status);
	}

	throw new Error("Unsupported content type for downloadFile");
};
const getMediaType = (mime: string) => {
	if (mime.startsWith("image/")) {
		return "image";
	}
	if (mime.startsWith("video/")) {
		return "video";
	}
	if (mime.startsWith("audio/")) {
		return "audio";
	}
	// webp is treated as sticker
	if (mime === "image/webp") {
		return "sticker";
	}
	return "document";
};

/**
 * sendFile implementation that prepares the media and calls sendMessage.
 */
export const createSendFile = async (
	content: any,
	options?: SendFileOptions
) => {
	if (!content) {
		throw new Error("No content provided");
	}

	const opts = options ? { ...options } : {};

	const mContent = await downloadFile(content);
	const { fileType, stream } = await getStreamType(mContent);

	const mediaType = getMediaType(fileType.mime);

	let message: any = {
		[mediaType]: { stream },
	};
	if (mediaType === "image" || mediaType === "video") {
		message.caption = (opts as any).caption || "";
		message.mimetype = fileType.mime;
	} else if (mediaType === "audio") {
		const isPtt = (opts as any).ptt || fileType.mime === "audio/ogg";
		message = {
			audio: { stream: convertAudio(stream, !!isPtt) },
			ptt: !!isPtt,
			mimetype: isPtt ? "audio/ogg; codecs=opus" : "audio/mpeg",
		};
	} else if (mediaType === "document") {
		message.mimetype =
			(opts as any).mimetype ||
			fileType.mime ||
			"application/octet-stream";
		message.fileName = (opts as any).fileName || `file.${fileType.ext}`;
	}
	return { ...message, ...opts } as AnyMediaMessageContent;
};

/**
 * Attach sendFile to a socket instance once (binds the function).
 */
export const attachSendFile = (
	sock: any,
	attributes?: PropertyDescriptor & ThisType<any>
): void => {
	const s = sock as WASocket;
	if (typeof s.sendFile === "function") {
		return;
	}

	const bound: SendFile = async (jid, content, options, quotedMsg) => {
		const { quoted, ...rest } = options || {};

		const qm = quotedMsg || quoted;
		const msg = await createSendFile(content, rest);
		return s.sendMessage(jid, msg, qm ? { quoted: qm } : undefined);
	};

	Object.defineProperty(s, "sendFile", {
		value: bound,
		writable: false,
		configurable: false,
		enumerable: false,
		...attributes,
	});
};
