import { existsSync } from "fs";
import { PassThrough, Readable } from "stream";
import type {
	AnyMediaMessageContent,
	AnyMessageContent,
	MiscMessageGenerationOptions,
} from "baileys";
import { fileTypeFromBuffer } from "file-type";
import { fetch } from "undici";
import type { SupportedMediaType } from "./mime-types";
import type { WASocket } from "./types";

const isBuffer = (data: any): data is Buffer => {
	return (
		data instanceof Buffer ||
		data instanceof ArrayBuffer ||
		ArrayBuffer.isView(data)
	);
};
const isDataUrl = (data: any): data is string => {
	return typeof data === "string" && data.startsWith("data:");
};
const isLocalFile = (data: any): data is string => {
	return typeof data === "string" && existsSync(data);
};
export const downloadFile = async (
	content: any
): Promise<Readable | undefined> => {
	if (isBuffer(content)) {
		return Readable.from(content);
	}
	if (isDataUrl(content)) {
		const base64Data = content.split(",")[1];
		const buffer = Buffer.from(base64Data!, "base64");
		return Readable.from(buffer);
	}
	if (isLocalFile(content)) {
		const fs = await import("fs");
		return fs.createReadStream(content);
	}
	if (typeof content === "string" && /^https?:\/\//.test(content)) {
		const res = await fetch(content);
		if (!res.ok) {
			throw new Error(`Failed to fetch file from URL: ${res.statusText}`);
		}

		const stream = res.body;
		if (!stream) {
			throw new Error("Response body is null");
		}
		// Convert Web ReadableStream (from undici fetch) to Node.js Readable
		const isWebStream = typeof (stream as any).getReader === "function";
		return isWebStream
			? Readable.fromWeb(stream as any)
			: (stream as any as Readable);
	}
};

// Peek the beginning of the stream to detect file type without losing data
const peekStream = async (stream: Readable, bytes = 4100) => {
	return await new Promise<{ head: Buffer; combined: Readable }>(
		(resolve, reject) => {
			const chunks: Buffer[] = [];
			let length = 0;
			const combined = new PassThrough();

			const cleanup = () => {
				stream.removeListener("data", onData);
				stream.removeListener("end", onEnd);
				stream.removeListener("error", onError);
			};

			const flushAndPipe = () => {
				const head = Buffer.concat(chunks);
				combined.write(head);
				// Pipe the rest of the original stream into combined
				stream.pipe(combined);
				resolve({ head, combined });
			};

			const onData = (chunk: Buffer) => {
				chunks.push(chunk);
				length += chunk.length;
				if (length >= bytes) {
					cleanup();
					// Pause before piping to avoid missing 'pipe'
					stream.pause();
					// Resume on next tick so piping starts after write
					setImmediate(() => {
						stream.resume();
						flushAndPipe();
					});
				}
			};

			const onEnd = () => {
				cleanup();
				const head = Buffer.concat(chunks);
				combined.end(head);
				resolve({ head, combined });
			};

			const onError = (err: unknown) => {
				cleanup();
				reject(err);
			};

			stream.on("data", onData);
			stream.once("end", onEnd);
			stream.once("error", onError);
		}
	);
};

const getFileMimeType = async (stream: Readable) => {
	const { head, combined } = await peekStream(stream);
	const ft = await fileTypeFromBuffer(head);
	return {
		fileType: ft ?? { mime: "application/octet-stream", ext: "bin" },
		stream: combined as Readable,
	};
};
const getMediaType = (mime: string): SupportedMediaType => {
	if (mime.startsWith("image/")) {
		return "image";
	}
	if (mime.startsWith("video/")) {
		return "video";
	}
	if (mime.startsWith("audio/")) {
		return "audio";
	}
	return "document";
};

export const sockSendFile = async (
	content: any,
	options?: Partial<AnyMessageContent> | null
): Promise<AnyMediaMessageContent> => {
	const stream = await downloadFile(content);
	if (!stream) {
		throw new Error("Failed to download file");
	}
	const { fileType, stream: processedStream } = await getFileMimeType(stream);
	const mediaType = getMediaType(fileType.mime);
	const fileName = `file-${Date.now()}.${fileType.ext || "bin"}`;
	// if file size > 64 * 1024 * 1024 mediaType = document
	// because whatsapp only supports sending image/video/audio < 64MB
	// const MAX_SIZE = 64 * 1024 * 1024;

	const msgContent = {
		[mediaType]: {
			stream: processedStream,
		},
		...((mediaType === "document" || mediaType === "audio") && {
			mimetype: fileType.mime,
			fileName,
		}),
		// only image and video can have caption
		...(((options as any)?.caption as string) &&
			(mediaType === "image" || mediaType === "video") && {
				caption: (options as any).caption,
			}),
		...options,
	} as AnyMediaMessageContent;

	return msgContent;
};

// Helper to attach sendFile to a socket instance at runtime
export const attachSendFile = (sock: any): WASocket => {
	const s = sock as WASocket;
	if (typeof (s as any).sendFile !== "function") {
		(s as any).sendFile = async (
			jid: string,
			content: any,
			options?: AnyMediaMessageContent,
			miscOptions?: MiscMessageGenerationOptions
		) => {
			const msg = await sockSendFile(content, options);
			await s.sendMessage(jid, msg, miscOptions);
			return msg;
		};
	}
	return s;
};
