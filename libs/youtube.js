import Ytdl from "@distube/ytdl-core";
import {
	createStream,
	downloadFromInfoCallback,
} from "./youtube/stream-util.js";

process.env.YTDL_NO_UPDATE = "true";

class YouTube {
	constructor() {
		this._Agent = Ytdl.createAgent();
	}

	/**
	 *
	 * @param {String} url
	 * @param {Partial<Ytdl.getInfoOptions>} [options]
	 * @returns
	 */
	async getInfo(url, options) {
		const { videoDetails, formats } = await Ytdl.getInfo(url, options);

		const {
			title,
			description,
			category,
			publishDate,
			uploadDate,
			author,
		} = videoDetails;
		return {
			title,
			description,
			category,
			publishDate,
			uploadDate,
			author,
			...this._getFormat(formats, options),
		};
	}

	/**
	 *
	 * @param {Ytdl.videoFormat[]} formats
	 * @param {"audio" | "video"} type
	 * @returns
	 */
	_filterFormats(formats, type) {
		return formats.filter((format) =>
			type === "video"
				? format.hasVideo && format.hasAudio
				: format.hasAudio
		);
	}

	/**
	 *
	 * @param {Ytdl.videoFormat[]} formats
	 * @returns
	 */
	_getFormat(formats, options) {
		const videoFormat = this._filterFormats(formats, "video").find(
			(f) => f.quality === "medium"
		);
		const audioFormat = this._filterFormats(formats, "audio").find(
			(f) => f.audioBitrate === 128
		);
		if (!videoFormat || !audioFormat) {
			throw new Error("No suitable format found");
		}

		return {
			video: {
				...videoFormat,
				download: () => this._createStream(videoFormat, options),
			},
			audio: {
				...audioFormat,
				download: () => this._createStream(audioFormat, options),
			},
		};
	}

	/**
	 *
	 * @param {Ytdl.videoFormat} format
	 * @returns {import("stream").Readable}
	 */
	_createStream(format, options) {
		const stream = createStream();
		downloadFromInfoCallback(stream, format, options);
		stream.on("error", (err) => console.error(err));
		return stream;
	}
}

const youtube = new YouTube();
export default youtube;
