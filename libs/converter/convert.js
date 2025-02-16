import { Ffmpeg } from "./ffmpeg.js";

/**
 * @param {Buffer | import("stream").Readable} input
 * @param {string} format
 * @param {string[]} outputOptions
 * @returns {Promise<Buffer>}
 * @throws {Error}
 */
export const convert = async (input, format, outputOptions) => {
	const ffmpeg = Ffmpeg(input, {
		toFormat: format,
		addOutputOptions: outputOptions,
	});
	const buffer = await ffmpeg.exec();
	return buffer;
};
