import { Ffmpeg } from "./ffmpeg.js";

/**
 * @param {Buffer | import("stream").Readable} input
 * @param {string} toFormat
 * @param {string[]} outputOptions
 * @returns {Promise<Buffer>}
 * @throws {Error}
 */
export const convert = async (input, toFormat, outputOptions) => {
	const ffmpeg = Ffmpeg(input, {
		toFormat,
		addOutputOptions: outputOptions,
	});
	const buffer = await ffmpeg.exec();
	return buffer;
};
