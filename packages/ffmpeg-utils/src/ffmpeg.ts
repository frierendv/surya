import FfmpegPath from "ffmpeg-static";
import fluentFfmpeg from "fluent-ffmpeg";
import type { FfmpegCommandOptions } from "fluent-ffmpeg";
import { streamFromBuffer, streamToBuffer } from "./util";

fluentFfmpeg.setFfmpegPath(FfmpegPath || "ffmpeg");

export const ffmpeg = (options?: FfmpegCommandOptions) => {
	const f = fluentFfmpeg(options);

	const inputBuffer = (buffer: Buffer, format?: string) => {
		const stream = streamFromBuffer(buffer);
		f.input(stream);
		if (format) {
			f.inputFormat(format);
		}
		return f;
	};

	const toBuffer = (): Promise<Buffer> => {
		return new Promise((resolve, reject) => {
			streamToBuffer(f.pipe()).then(resolve).catch(reject);
		});
	};
	return Object.assign(f, { toBuffer, inputBuffer });
};

declare module "fluent-ffmpeg" {
	interface FfmpegCommand {
		/**
		 * Saves the output to a buffer and returns it as a Promise.
		 */
		toBuffer: () => Promise<Buffer>;
		/**
		 * Adds an input from a Buffer.
		 */
		inputBuffer: (buffer: Buffer, format?: string) => this;
	}
}
