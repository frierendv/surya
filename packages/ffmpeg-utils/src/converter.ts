import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { PassThrough, Readable } from "stream";
import { ffmpeg } from "./ffmpeg";
import { isBuffer } from "./util";

const { mkdtemp, writeFile, rm } = fs.promises;
const TEMP_DIR_PREFIX = "ffmpeg-utils-";

const pipeFFmpegCommand = (
	cmd: ReturnType<typeof ffmpeg>,
	target?: PassThrough
) => {
	const out = target ?? new PassThrough();
	const ffOut = cmd.pipe(out, { end: true });
	if (ffOut !== out) {
		ffOut.on("error", (err: any) => out.emit("error", err));
	}
	cmd.on("error", (err: any) => out.emit("error", err));
	return out;
};

const toNodeBuffer = (data: Buffer | ArrayBuffer | ArrayBufferView) => {
	if (Buffer.isBuffer(data)) {
		return data;
	}
	if (data instanceof ArrayBuffer) {
		return Buffer.from(data);
	}
	if (ArrayBuffer.isView(data)) {
		return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
	}
	throw new TypeError("Unsupported buffer input type for ffmpeg conversion");
};

type SeekableInput = {
	path: string;
	cleanup?: () => Promise<void>;
};

const createFFmpegCommand = (input: Readable | Buffer | string) => {
	const cmd = ffmpeg();
	if (typeof input === "string") {
		cmd.input(input);
	} else if (isBuffer(input)) {
		cmd.inputBuffer(
			toNodeBuffer(input as Buffer | ArrayBuffer | ArrayBufferView)
		);
	} else {
		cmd.input(input);
	}
	return cmd;
};

const ensureSeekableInput = async (
	input: Readable | Buffer | string
): Promise<SeekableInput> => {
	if (typeof input === "string") {
		return { path: input };
	}

	const maybePath = (input as { path?: string | Buffer }).path;
	if (typeof maybePath === "string" || Buffer.isBuffer(maybePath)) {
		const resolvedPath = Buffer.isBuffer(maybePath)
			? maybePath.toString()
			: maybePath;
		if (typeof (input as Readable).destroy === "function") {
			(input as Readable).destroy();
		}
		return { path: resolvedPath };
	}

	const tempDir = await mkdtemp(path.join(tmpdir(), TEMP_DIR_PREFIX));
	const tempFilePath = path.join(tempDir, "source");
	const cleanup = async () => {
		await rm(tempDir, { recursive: true, force: true });
	};

	if (isBuffer(input)) {
		const buffer = toNodeBuffer(
			input as Buffer | ArrayBuffer | ArrayBufferView
		);
		await writeFile(tempFilePath, buffer);
		return { path: tempFilePath, cleanup };
	}

	const tempWriteStream = fs.createWriteStream(tempFilePath);
	try {
		await pipeline(input as Readable, tempWriteStream);
	} catch (err) {
		tempWriteStream.destroy();
		await cleanup().catch(() => undefined);
		throw err;
	}

	return { path: tempFilePath, cleanup };
};

type ConversionOptions = {
	requireSeekable?: boolean;
};
type ConversionStream = PassThrough & {
	toBuffer: () => Promise<Buffer>;
	_buffer: Buffer;
};

const createConversionStream = (
	input: Readable | Buffer | string,
	configure: (cmd: ReturnType<typeof ffmpeg>) => void,
	options: ConversionOptions = {}
): ConversionStream => {
	const out = Object.assign(new PassThrough(), { _buffer: Buffer.alloc(0) });

	(async () => {
		let resolved: SeekableInput | undefined;
		let cleaned = false;

		const cleanupOnce = async () => {
			if (cleaned) {
				return;
			}
			cleaned = true;
			if (resolved?.cleanup) {
				await resolved.cleanup().catch(() => {});
			}
		};

		try {
			let source: Readable | Buffer | string;
			if (options.requireSeekable === true) {
				resolved = await ensureSeekableInput(input);
				source = resolved.path;
			} else {
				source = input;
			}

			const cmd = createFFmpegCommand(source);

			configure(cmd);
			pipeFFmpegCommand(cmd, out);

			void out.on("data", (chunk: Buffer) => {
				out._buffer = Buffer.concat([out._buffer, chunk]);
			});
			void out.once("error", () => {
				void cleanupOnce();
			});
			void out.once("close", () => {
				void cleanupOnce();
			});
			void cmd.once("end", () => {
				void cleanupOnce();
			});
			void cmd.once("error", () => {
				void cleanupOnce();
			});
		} catch (err) {
			await cleanupOnce();
			queueMicrotask(() => {
				const error =
					err instanceof Error ? err : new Error(String(err));
				out.emit("error", error);
			});
		}
	})().catch((err) => {
		queueMicrotask(() => {
			const error = err instanceof Error ? err : new Error(String(err));
			out.emit("error", error);
		});
	});

	// return out;
	return Object.assign(out, {
		toBuffer: async () => {
			const chunks: Buffer[] = [];
			for await (const chunk of out) {
				chunks.push(isBuffer(chunk) ? chunk : Buffer.from(chunk));
			}
			return Buffer.concat(chunks);
		},
	});
};

/**
 * Convert audio to mp3 or ogg (for ptt) using ffmpeg.
 */
export const convertAudio = (
	input: Readable | Buffer | string,
	ptt = false
): ConversionStream => {
	const format = ptt ? "ogg" : "mp3";
	const codec = ptt ? "libopus" : "libmp3lame";
	const bitrate = ptt ? "48k" : "128k";
	const channels = ptt ? 1 : 2;

	return createConversionStream(input, (cmd) => {
		cmd.noVideo()
			.format(format)
			.audioCodec(codec)
			.audioBitrate(bitrate)
			.audioChannels(channels)
			.addOption("-avoid_negative_ts", "make_zero");
	});
};

/**
 * Convert image/video to webp using ffmpeg (for stickers).
 */
export const convertToWebp = (
	input: Readable | Buffer | string,
	inputType: "image" | "video"
): ConversionStream => {
	return createConversionStream(
		input,
		(cmd) => {
			cmd.toFormat("webp").addOption(
				"-vcodec",
				"libwebp",
				"-vf",
				"scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p];[b][p] paletteuse"
			);

			if (inputType === "video") {
				cmd.addOption(
					"-loop",
					"0",
					"-ss",
					"00:00:00",
					"-t",
					"00:00:20",
					"-preset",
					"default",
					"-an",
					"-vsync",
					"0"
				);
			}
		},
		{ requireSeekable: inputType === "video" }
	);
};

/**
 * Convert webp to png using ffmpeg.
 */
export const convertWebpToPng = (
	input: Readable | Buffer | string
): ConversionStream => {
	return createConversionStream(input, (cmd) => {
		cmd.toFormat("image2pipe").addOption(
			"-vcodec",
			"png",
			"-frames:v",
			"1"
		);
	});
};

/**
 * Convert video to audio using ffmpeg.
 */
export const convertVideoToAudio = (
	input: Readable | Buffer | string,
	format: "mp3" | "aac" | "wav" = "mp3"
): ConversionStream => {
	return createConversionStream(
		input,
		(cmd) => {
			cmd.inputOptions(["-probesize", "50M", "-analyzeduration", "100M"])
				.noVideo()
				.format(format)
				.audioChannels(2)
				.addOption("-avoid_negative_ts", "make_zero");

			if (format === "mp3") {
				cmd.audioCodec("libmp3lame").audioBitrate("128k");
			} else if (format === "aac") {
				cmd.audioCodec("aac").audioBitrate("128k");
			} else if (format === "wav") {
				cmd.audioCodec("pcm_s16le");
			}
		},
		{ requireSeekable: true }
	);
};
