import { existsSync } from "fs";
import { PassThrough, Readable } from "stream";
import { fileTypeFromBuffer } from "file-type";

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

/**
 * Get mime type from a stream by reading the initial bytes
 * and using file-type to detect it.
 */
export const getMediaMimeType = async (stream: Readable) => {
	const { head, combined } = await peekStream(stream);
	const ft = await fileTypeFromBuffer(head);
	return {
		fileType: ft ?? { mime: "application/octet-stream", ext: "bin" },
		stream: combined as Readable,
	};
};
/**
 * Get supported media type from mime for Baileys
 * (image, video, audio, sticker, document)
 */
export const getMediaType = (mime: string) => {
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

export const isBuffer = (data: any): data is Buffer => {
	return (
		data instanceof Buffer ||
		data instanceof ArrayBuffer ||
		ArrayBuffer.isView(data)
	);
};
export const isDataUrl = (data: any): data is string => {
	return typeof data === "string" && data.startsWith("data:");
};
export const isLocalFile = (data: any): data is string => {
	return typeof data === "string" && existsSync(data);
};
