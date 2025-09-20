import { Readable, type PassThrough, type Writable } from "stream";

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
