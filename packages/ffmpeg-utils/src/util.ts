import { existsSync } from "fs";
import { PassThrough, Readable, type Writable } from "stream";
import fileType from "file-type";
import type { FileTypeResult } from "file-type";

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
	const ftStream = await fileType.stream(stream);
	return {
		fileType: ftStream.fileType || {
			ext: "bin",
			mime: "application/octet-stream",
		},
		stream: Readable.from(ftStream),
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
