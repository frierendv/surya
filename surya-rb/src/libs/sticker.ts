import type { PassThrough } from "stream";
import { convertToWebp, isBuffer, streamToBuffer } from "@surya/ffmpeg-utils";
// @ts-expect-error: no types
import webPMux from "node-webpmux";

const exifMetadata = {
	"sticker-pack-id":
		"com.snowcorp.stickerly.android.stickercontentprovider b5e7275f-f1de-4137-961f-57becfad34f2",
	"sticker-pack-name": "@roseanne_park",
	"sticker-pack-publisher": "ItsRose",
	"git-url": "https://github.com/xct007",
	"android-app-store-link":
		"https://play.google.com/store/apps/details?id=com.snowcorp.stickerly.android",
	"ios-app-store-link":
		"https://play.google.com/store/apps/details?id=com.snowcorp.stickerly.android",
};

const generateStickerExif = (author: string, packName: string) => {
	const metadata = { ...exifMetadata };
	if (author) {
		metadata["sticker-pack-publisher"] = author;
	}
	if (packName) {
		metadata["sticker-pack-name"] = packName;
	}

	const jsonData = Buffer.from(JSON.stringify(metadata), "utf-8");
	const exifHeader = Buffer.from([
		0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57,
		0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
	]);

	const exifBuffer = Buffer.concat([exifHeader, jsonData]);
	exifBuffer.writeUIntLE(jsonData.length, 14, 4);
	return exifBuffer;
};

export const createSticker = async (
	input: Buffer | PassThrough,
	InputFormat: "image" | "video" | "webp",
	{ author = "", packName = "" }
): Promise<Buffer> => {
	const webp =
		InputFormat !== "webp" ? convertToWebp(input, InputFormat) : input;
	const webpBuffer = isBuffer(webp) ? webp : await streamToBuffer(webp);
	const img = new webPMux.Image();
	await img.load(webpBuffer);
	const exif = generateStickerExif(author, packName);
	img.exif = exif;
	return await img.save(null);
};
