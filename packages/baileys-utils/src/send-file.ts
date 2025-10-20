import { Readable } from "stream";
import {
	convertAudio,
	getStreamType,
	isBuffer,
	isDataUrl,
	isLocalFile,
} from "@surya/ffmpeg-utils";
import type { AnyMediaMessageContent } from "baileys";
import { fetch } from "undici";
import type { SendFile, SendFileOptions, WASocket } from "./types";

let cachedFs: typeof import("fs") | undefined;

const downloadFile = async (content: any): Promise<Readable> => {
	if (isBuffer(content)) {
		return Readable.from(content);
	}

	if (isDataUrl(content)) {
		const base64 = content.split(",")[1] || "";
		return Readable.from(Buffer.from(base64, "base64"));
	}

	if (isLocalFile(content)) {
		if (!cachedFs) {
			cachedFs = await import("fs");
		}
		return cachedFs.createReadStream(content);
	}

	if (typeof content === "string" && /^https?:\/\//.test(content)) {
		const res = await fetch(content);
		if (!res.ok) {
			throw new Error(
				`Failed to fetch file: ${res.status} ${res.statusText}`
			);
		}
		const body = res.body;
		if (!body) {
			throw new Error("Response body is null");
		}

		if ((body as any).pipe || (body as any).readable) {
			return body as unknown as Readable;
		}
		if (typeof (body as any).getReader === "function") {
			return Readable.fromWeb(body as any);
		}

		const buffer = Buffer.from(await res.arrayBuffer());
		return Readable.from(buffer);
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

	let stream = await downloadFile(content);
	const { fileType, stream: sniffedStream } = await getStreamType(stream);
	stream = sniffedStream;

	const mediaType = getMediaType(fileType.mime);

	if (mediaType === "audio") {
		const isPtt = (opts as any).ptt || fileType.mime === "audio/ogg";
		stream = convertAudio(stream, !!isPtt);
		(opts as any).ptt = !!isPtt;
		(opts as any).mimetype = isPtt
			? "audio/ogg; codecs=opus"
			: "audio/mpeg";
	}

	const mPayload: any = {
		[mediaType]: { stream },
	};
	switch (mediaType) {
		case "image":
		case "video":
			mPayload.caption = (opts as any).caption || "";
			mPayload.mimetype = fileType.mime;
			break;
		case "audio":
			mPayload.ptt = !!(opts as any).ptt;
			mPayload.mimetype = (opts as any).mimetype || fileType.mime;
			break;
		case "document":
			mPayload.mimetype =
				(opts as any).mimetype ||
				fileType.mime ||
				"application/octet-stream";
			mPayload.fileName =
				(opts as any).fileName || `file.${fileType.ext}`;
			break;
	}
	return { ...opts, ...mPayload } as AnyMediaMessageContent;
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
