import { createReadStream, readFileSync } from "fs";
import path from "path";
import { PassThrough, Readable } from "stream";
import { getStreamType, streamFromBuffer, streamToBuffer } from "../src/util";

const rootDir = path.resolve(__dirname, "./__fixtures__");

const pngPath = path.join(rootDir, "sample-image.png");
const mp4Path = path.join(rootDir, "sample-video.mp4");

describe("util streams", () => {
	test("streamFromBuffer produces a readable that ends", async () => {
		const buf = Buffer.from("abc");
		const readable = streamFromBuffer(buf);
		expect(readable.readable).toBe(true);
		const chunks: Buffer[] = [];
		for await (const chunk of readable as any as Readable) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		expect(Buffer.concat(chunks).toString()).toBe("abc");
	});

	test("getStreamType should work on stream from buffer", async () => {
		const buf = readFileSync(mp4Path);
		const readable = streamFromBuffer(buf);
		const { fileType, stream } = await getStreamType(readable);
		expect(fileType).toBeDefined();
		expect(fileType.ext).toBe("mp4");
		expect(fileType.mime).toBe("video/mp4");

		const chunks: Buffer[] = [];
		for await (const chunk of stream as any as Readable) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		const reconstituted = Buffer.concat(chunks);
		expect(reconstituted.equals(buf)).toBe(true);
	});
	test("getStreamType should work on PassThrough stream", async () => {
		const buf = readFileSync(mp4Path);
		const pass = new PassThrough();
		pass.end(buf);
		const { fileType, stream } = await getStreamType(pass);
		expect(fileType).toBeDefined();
		expect(fileType.ext).toBe("mp4");
		expect(fileType.mime).toBe("video/mp4");

		const chunks: Buffer[] = [];
		for await (const chunk of stream as any as Readable) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		const reconstituted = Buffer.concat(chunks);
		expect(reconstituted.equals(buf)).toBe(true);
	});
	test("getStreamType should work on ReadableStream", async () => {
		const buf = readFileSync(mp4Path);
		const readable = Readable.from(buf);
		const { fileType, stream } = await getStreamType(readable);
		expect(fileType).toBeDefined();
		expect(fileType.ext).toBe("mp4");
		expect(fileType.mime).toBe("video/mp4");

		const chunks: Buffer[] = [];
		for await (const chunk of stream as any as Readable) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		const reconstituted = Buffer.concat(chunks);
		expect(reconstituted.equals(buf)).toBe(true);
	});
	test("getStreamType should work on ReadableStream from web", async () => {
		const buf = readFileSync(mp4Path);
		const webStream = new ReadableStream({
			start(controller) {
				controller.enqueue(buf);
				controller.close();
			},
		});
		const readable = Readable.fromWeb(webStream as any);
		const { fileType, stream } = await getStreamType(readable);
		expect(fileType).toBeDefined();
		expect(fileType.ext).toBe("mp4");
		expect(fileType.mime).toBe("video/mp4");

		const chunks: Buffer[] = [];
		for await (const chunk of stream as any as Readable) {
			chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
		}
		const reconstituted = Buffer.concat(chunks);
		expect(reconstituted.equals(buf)).toBe(true);
	});

	test("streamToBuffer collects data from writable-like stream", async () => {
		const pass = new PassThrough();
		const promise = streamToBuffer(pass);
		pass.write("hello ");
		pass.write(Buffer.from("world"));
		pass.end();
		const out = await promise;
		expect(out.toString()).toBe("hello world");
	});

	test("streamToBuffer rejects on error", async () => {
		const pass = new PassThrough();
		const promise = streamToBuffer(pass);
		const err = new Error("boom");
		pass.emit("error", err);
		await expect(promise).rejects.toThrow("boom");
	});

	describe("getStreamType", () => {
		const pngStream = createReadStream(pngPath);
		const pngBuffer = readFileSync(pngPath);
		it("detects stream mime type without consuming it", async () => {
			const { fileType: ft, stream } = await getStreamType(pngStream);
			expect(ft).toBeDefined();
			expect(ft.ext).toBe("png");
			expect(ft.mime).toBe("image/png");

			const chunks: Buffer[] = [];
			for await (const chunk of stream as any as Readable) {
				chunks.push(
					Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
				);
			}
			const reconstituted = Buffer.concat(chunks);
			expect(reconstituted.equals(pngBuffer)).toBe(true);
		});
	});
});
