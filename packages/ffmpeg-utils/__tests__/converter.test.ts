import { createReadStream, readFileSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { fromBuffer, fromStream } from "file-type";
import {
	convertAudio,
	convertToWebp,
	convertVideoToAudio,
	convertWebpToPng,
} from "../src/converter";

const rootDir = path.resolve(__dirname, "./__fixtures__");

const pngPath = path.join(rootDir, "sample-image.png");
const webpPath = path.join(rootDir, "sample-image.webp");
const mp3Path = path.join(rootDir, "sample-audio.mp3");
const mp4Path = path.join(rootDir, "sample-video.mp4");

const getResultType = async (input: Buffer | Readable) => {
	let type;
	if (Buffer.isBuffer(input)) {
		type = await fromBuffer(input);
	} else {
		type = await fromStream(input as any);
	}
	return type?.mime;
};

describe("FFmpeg Converters", () => {
	describe("Stream Converters", () => {
		type ConversionCase = {
			name: string;
			convert: () => ReturnType<typeof convertAudio>;
			assert: (mime: string | undefined) => void;
			output?: Buffer;
		};

		const streamCases: ConversionCase[] = [
			{
				name: "convert image stream to webp",
				convert: () =>
					convertToWebp(createReadStream(pngPath), "image"),
				assert: (mime) => expect(mime).toBe("image/webp"),
			},
			{
				name: "convert webp stream to png",
				convert: () => convertWebpToPng(createReadStream(webpPath)),
				assert: (mime) => expect(mime).toBe("image/png"),
			},
			{
				name: "convert audio stream to opus",
				convert: () => convertAudio(createReadStream(mp3Path), true),
				assert: (mime) => expect(mime).toContain("opus"),
			},
			{
				name: "convert audio stream to mp3",
				convert: () => convertAudio(createReadStream(mp3Path), false),
				assert: (mime) => expect(mime).toContain("mpeg"),
			},
			{
				name: "convert video stream to mp3 audio",
				convert: () =>
					convertVideoToAudio(createReadStream(mp4Path), "mp3"),
				assert: (mime) => expect(mime).toBe("audio/mpeg"),
			},
		];

		beforeAll(async () => {
			await Promise.all(
				streamCases.map(async (testCase) => {
					const stream = testCase.convert();
					if (typeof stream.toBuffer !== "function") {
						throw new TypeError(
							"Conversion stream missing toBuffer method"
						);
					}
					testCase.output = await stream.toBuffer();
				})
			);
		});

		streamCases.forEach((testCase) => {
			it(`should ${testCase.name}`, async () => {
				const outputBuffer = testCase.output;
				expect(outputBuffer).toBeDefined();
				const resultType = await getResultType(outputBuffer as Buffer);
				testCase.assert(resultType);
			});
		});
	});

	describe("Buffer Converters", () => {
		const pngBuffer = readFileSync(pngPath);
		const webpBuffer = readFileSync(webpPath);
		const mp3Buffer = readFileSync(mp3Path);
		const mp4Buffer = readFileSync(mp4Path);

		type ConversionCase = {
			name: string;
			convert: () => ReturnType<typeof convertAudio>;
			assert: (mime: string | undefined) => void;
			output?: Buffer;
		};

		const bufferCases: ConversionCase[] = [
			{
				name: "convert image buffer to webp",
				convert: () => convertToWebp(pngBuffer, "image"),
				assert: (mime) => expect(mime).toBe("image/webp"),
			},
			{
				name: "convert webp buffer to png",
				convert: () => convertWebpToPng(webpBuffer),
				assert: (mime) => expect(mime).toBe("image/png"),
			},
			{
				name: "convert audio buffer to ogg",
				convert: () => convertAudio(mp3Buffer, true),
				assert: (mime) => expect(mime).toBe("audio/opus"),
			},
			{
				name: "convert audio buffer to mp3",
				convert: () => convertAudio(mp3Buffer, false),
				assert: (mime) => expect(mime).toBe("audio/mpeg"),
			},
			{
				name: "convert video buffer to mp3 audio",
				convert: () => convertVideoToAudio(mp4Buffer, "mp3"),
				assert: (mime) => expect(mime).toBe("audio/mpeg"),
			},
		];

		beforeAll(async () => {
			await Promise.all(
				bufferCases.map(async (testCase) => {
					const stream = testCase.convert();
					if (typeof stream.toBuffer !== "function") {
						throw new TypeError(
							"Conversion stream missing toBuffer method"
						);
					}
					testCase.output = await stream.toBuffer();
				})
			);
		});

		bufferCases.forEach((testCase) => {
			it(`should ${testCase.name}`, async () => {
				const outputBuffer = testCase.output;
				expect(outputBuffer).toBeDefined();
				const resultType = await getResultType(outputBuffer as Buffer);
				testCase.assert(resultType);
			});
		});
	});
});
