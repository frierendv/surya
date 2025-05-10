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

/**
 * Converts input audio to OGG format using FFmpeg.
 *
 * Ref: https://github.com/WhiskeySockets/Baileys/tree/feature/communities?tab=readme-ov-file#audio-message
 * @param {Buffer} input - The input audio data.
 * @returns {Promise<Buffer>} - The converted audio as a Buffer.
 */
export const convertAudio = async (input) => {
	const outputOptions = ["-c:a", "libvorbis", "-b:a", "128k", "-ac", "1"];
	const ffmpeg = Ffmpeg(input, {
		outputOptions,
		toFormat: "ogg",
	});
	const buffer = await ffmpeg.exec();
	return buffer;
};
