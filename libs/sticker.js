import { fileTypeFromBuffer } from "file-type";
import webPMux from "node-webpmux";
import { convert } from "./converter/convert.js";
import * as formats from "./converter/formats.js";

class StickerError extends Error {
	constructor(message, details = {}) {
		super(message);
		this.name = "StickerError";
		this.details = details;
	}
}

/**
 * @typedef {Object} StickerOptions
 * @property {string} [packname='ItsRose']
 * @property {string} [author='ItsRose']
 * @property {string|string[]} [emojis=['❤️']]
 */

/**
 * Generates EXIF metadata for a sticker.
 *
 * @param {string} author - The author's name.
 * @param {string} packName - The sticker pack name.
 * @param {string | string[]} emojis - Associated emojis.
 * @returns {Buffer} The EXIF metadata buffer.
 */
const generateExifMetadata = (author, packName, emojis) => {
	const metadata = {
		"sticker-pack-id":
			"com.snowcorp.stickerly.android.stickercontentprovider b5e7275f-f1de-4137-961f-57becfad34f2",
		"sticker-pack-name": packName,
		"sticker-pack-publisher": author,
		emojis: Array.isArray(emojis) ? emojis : [emojis],
		"git-url": "https://github.com/xct007",
		"android-app-store-link":
			"https://play.google.com/store/apps/details?id=com.snowcorp.stickerly.android",
		"ios-app-store-link":
			"https://play.google.com/store/apps/details?id=com.snowcorp.stickerly.android",
	};

	const jsonData = Buffer.from(JSON.stringify(metadata), "utf-8");
	const exifHeader = Buffer.from([
		0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
		0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
	]);

	const exifBuffer = Buffer.concat([exifHeader, jsonData]);
	exifBuffer.writeUIntLE(jsonData.length, 14, 4);
	return exifBuffer;
};

/**
 * Creates a sticker from the input buffer.
 *
 * @param {Buffer} input - The input image or video buffer.
 * @param {Object} options - Sticker options.
 * @param {string} [options.packname="ItsRose"] - The pack name.
 * @param {string} [options.author="ItsRose"] - The author's name.
 * @param {string | string[]} [options.emojis=["❤️"]] - Associated emojis.
 * @returns {Promise<Buffer>} The resulting WebP image buffer.
 * @throws {StickerError} If the file type is invalid.
 */
export async function createSticker(input, options = {}) {
	try {
		if (!Buffer.isBuffer(input)) {
			throw new StickerError("Invalid input: Buffer required");
		}

		const {
			packname = "ItsRose",
			author = "ItsRose",
			emojis = ["❤️"],
		} = options;
		const fileType = await fileTypeFromBuffer(input);

		if (!fileType?.mime) {
			throw new StickerError("Unsupported file type");
		}

		const [formatType] = fileType.mime.split("/");
		const conversionArgs = formats.sticker[formatType];

		if (!conversionArgs) {
			throw new StickerError(`Unsupported format type: ${formatType}`);
		}

		const webpBuffer = fileType.mime.includes("webp")
			? input
			: await convert(input, "webp", conversionArgs);

		const webpImage = new webPMux.Image();
		await webpImage.load(webpBuffer);
		webpImage.exif = generateExifMetadata(author, packname, emojis);

		// @ts-ignore
		return await webpImage.save(null);
	} catch (error) {
		throw new StickerError("Sticker creation failed", { cause: error });
	}
}
