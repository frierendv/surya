import { existsSync } from "fs";
import { PassThrough, Readable, type Writable } from "stream";
import fileType from "file-type";

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
export const getStreamType = async (stream: Readable) => {
	const { head, combined } = await peekStream(stream);
	const ft = await fileType.fromBuffer(head);
	return {
		fileType: ft ?? { mime: "application/octet-stream", ext: "bin" },
		stream: combined as Readable,
	};
};

export const streamFromBuffer = (buffer: Buffer) => {
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
