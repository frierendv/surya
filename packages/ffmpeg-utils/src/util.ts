import { existsSync } from "fs";
import { PassThrough, Readable, type Writable } from "stream";
import fileType from "file-type";
import type { FileTypeResult } from "file-type";

const peekStream = async (source: Readable, bytes = 4100) => {
	return await new Promise<{ head: Buffer; stream: Readable }>(
		(resolve, reject) => {
			const chunks: Buffer[] = [];
			let length = 0;
			const stream = new PassThrough();

			const cleanup = () => {
				source.removeListener("data", onData);
				source.removeListener("end", onEnd);
				source.removeListener("error", onError);
			};

			const flushAndPipe = () => {
				const head = Buffer.concat(chunks);
				stream.write(head);
				// Pipe the rest of the original stream into combined
				source.pipe(stream);
				resolve({ head, stream });
			};

			const onData = (chunk: Buffer) => {
				chunks.push(chunk);
				length += chunk.length;
				if (length >= bytes) {
					cleanup();
					// Pause before piping to avoid missing 'pipe'
					source.pause();
					// Resume on next tick so piping starts after write
					setImmediate(() => {
						source.resume();
						flushAndPipe();
					});
				}
			};

			const onEnd = () => {
				cleanup();
				const head = Buffer.concat(chunks);
				stream.end(head);
				resolve({ head, stream });
			};

			const onError = (err: unknown) => {
				cleanup();
				reject(err);
			};

			source.on("data", onData);
			source.once("end", onEnd);
			source.once("error", onError);
		}
	);
};

/**
 * Get mime type from a stream by reading the initial bytes
 * and using file-type to detect it.
 */
export const getStreamType = async (
	stream: Readable
): Promise<{
	fileType: FileTypeResult | { ext: "bin"; mime: "application/octet-stream" };
	stream: Readable;
}> => {
	const { head, stream: ft } = await peekStream(stream, 4100);
	const ftResult =
		(await (fileType as any).fromBuffer?.(head)) ||
		(await (fileType as any).fileTypeFromBuffer?.(head)) ||
		null;
	return {
		fileType: ftResult || {
			ext: "bin",
			mime: "application/octet-stream",
		},
		stream: ft,
	};
};

export const streamFromBuffer = (buffer: Buffer): Readable => {
	const readableStream = new Readable();
	readableStream.push(buffer);
	readableStream.push(null);
	return readableStream;
};

export const streamToBuffer = async (
	stream: Writable | PassThrough
): Promise<Buffer> => {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		stream.on("data", (chunk) => {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		});
		stream.on("end", () => {
			resolve(Buffer.concat(chunks));
		});
		stream.on("error", (err) => {
			reject(err);
		});
	});
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
