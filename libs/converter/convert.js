import crypto from "crypto";
import Ffmpeg from "fluent-ffmpeg";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";

class ConversionError extends Error {
	constructor(message, details = {}) {
		super(message);
		this.name = "ConversionError";
		this.details = details;
	}
}

/**
 * @param {Buffer} buffer
 * @returns {Readable}
 */
const createBufferStream = (buffer) => {
	return new Readable({
		read() {
			this.push(buffer);
			this.push(null);
		},
	});
};

/**
 * @param {string} path
 * @returns {Buffer}
 * @throws {ConversionError}
 */
const safeReadAndDelete = (path) => {
	try {
		if (!existsSync(path)) {
			throw new ConversionError("Temporary file not found");
		}
		const buffer = readFileSync(path);
		unlinkSync(path);
		return buffer;
	} catch (error) {
		throw new ConversionError("File operation failed", { cause: error });
	}
};

/**
 * @param {Buffer} input
 * @param {string} format
 * @param {string[]} args
 * @returns {Promise<Buffer>}
 * @throws {ConversionError}
 */
export const convert = async (input, format, args) => {
	if (!input || !Buffer.isBuffer(input)) {
		throw new ConversionError("Invalid input buffer");
	}

	const tempPath = join(tmpdir(), crypto.randomBytes(16).toString("hex"));

	return new Promise((resolve, reject) => {
		Ffmpeg()
			.input(createBufferStream(input))
			.addOutputOptions(args)
			.format(format)
			.on("end", () => {
				try {
					resolve(safeReadAndDelete(tempPath));
				} catch (error) {
					reject(error);
				}
			})
			.on("error", (error) =>
				reject(
					new ConversionError("Conversion failed", { cause: error })
				)
			)
			.save(tempPath);
	});
};
