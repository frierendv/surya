import Ytdl from "@distube/ytdl-core";
import {
	createStream,
	downloadFromInfoCallback,
} from "./youtube/stream-util.js";

process.env.YTDL_NO_UPDATE = "true";

class YouTube {
	constructor() {
		this.createProxyAgent = Ytdl.createProxyAgent;
		this.createAgent = Ytdl.createAgent;
	}

	/**
	 *
	 * @param {string} url
	 * @param {Ytdl.getInfoOptions} [options]
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

	_getFormat(formats, options) {
		const videoFormat = this._findFormat(
			formats,
			"video",
			"quality",
			"medium"
		);
		const audioFormat = this._findFormat(
			formats,
			"audio",
			"audioBitrate",
			128
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

	_findFormat(formats, type, key, value) {
		return this._filterFormats(formats, type).find(
			(format) => format[key] === value
		);
	}

	_filterFormats(formats, type) {
		return formats.filter((format) =>
			type === "video"
				? format.hasVideo && format.hasAudio
				: format.hasAudio
		);
	}

	_createStream(format, options) {
		const stream = createStream();
		downloadFromInfoCallback(stream, format, options);
		stream.on("error", (err) => console.error(err));
		return stream;
	}
}

const youtube = new YouTube();
export default youtube;
