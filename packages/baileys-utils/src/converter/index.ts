import { PassThrough, Readable } from "stream";
import { ffmpeg } from "@surya/ffmpeg-utils";
import { isBuffer } from "./media-type";

/**
 * Convert audio to mp3 or ogg (for ptt) using ffmpeg.
 *
 * Since Baileys does not handle audio conversion,
 */
export const convertAudio = (input: Readable | Buffer, ptt = false) => {
	const command = ffmpeg();
	if (isBuffer(input)) {
		command.inputBuffer(input);
	} else {
		command.input(input);
	}

	const format = ptt ? "ogg" : "mp3";
	const codec = ptt ? "libopus" : "libmp3lame";

	command.noVideo();
	command.format(format);
	command.audioCodec(codec);
	if (!ptt) {
		command.audioBitrate("128k");
	} else {
		command.audioBitrate("48k");
	}
	command.audioChannels(ptt ? 1 : 2);
	command.addOption("-avoid_negative_ts", "make_zero");

	const out = new PassThrough();
	const ffOut = command.pipe(out, { end: true });
	if (ffOut !== out) {
		ffOut.on("error", (err: any) => out.emit("error", err));
	}
	command.on("error", (err: any) => out.emit("error", err));

	return out;
};

const cvFormat = [
	"-vcodec",
	"libwebp",
	"-vf",
	"scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p];[b][p] paletteuse",
];
/**
 * Convert image/video to webp using ffmpeg.
 *
 * This is used for stickers.
 */
export const convertToWebp = (
	input: Readable | Buffer,
	inputType: "image" | "video"
) => {
	const command = ffmpeg();
	if (isBuffer(input)) {
		command.inputBuffer(input);
	} else {
		command.input(input);
	}
	command.toFormat("webp");

	command.addOption(...cvFormat);
	if (inputType === "video") {
		command.addOption(
			...[
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
				"0",
			]
		);
	}

	const out = new PassThrough();
	const ffOut = command.pipe(out, { end: true });
	if (ffOut !== out) {
		ffOut.on("error", (err: any) => out.emit("error", err));
	}
	command.on("error", (err: any) => out.emit("error", err));

	return out;
};
