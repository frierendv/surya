import crypto from "crypto";
import FluentFfmpeg from "fluent-ffmpeg";
import { existsSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Readable } from "stream";

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
 * @throws {Error}
 */
const safeReadAndDelete = (path) => {
	if (!existsSync(path)) {
		throw new Error("Temporary file not found");
	}
	const buffer = readFileSync(path);
	unlinkSync(path);
	return buffer;
};

/**
 * @type {import("./ffmpeg").F}
 */
export const Ffmpeg = (input, commands) => {
	if (Buffer.isBuffer(input)) {
		input = createBufferStream(input);
	} else if (!(input instanceof Readable)) {
		throw new Error("Invalid input stream");
	}

	const tempPath = join(tmpdir(), crypto.randomBytes(16).toString("hex"));

	const command = FluentFfmpeg().input(input);

	/**
	 * @returns {Promise<Buffer>}
	 */
	const exec = () => {
		for (const key in commands) {
			if (key in command) {
				command[key](commands[key]);
			}
		}
		return new Promise((resolve, reject) => {
			command
				.on("end", () => {
					try {
						resolve(safeReadAndDelete(tempPath));
					} catch (error) {
						reject(error);
					}
				})
				.on("error", (error) =>
					reject(new Error("Conversion failed", { cause: error }))
				)
				.save(tempPath);
		});
	};

	return {
		exec,
	};
};
