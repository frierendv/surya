// TODO: VIDEO MP4
import { MediaProcessor } from "./youtube/media.js";
import { YouTubeAPI } from "./youtube/yt-api.js";

export class YouTube {
	constructor() {
		this.api = new YouTubeAPI();
	}

	async get(url, quality) {
		const videoId = this.extractVideoId(url);
		const data = await this.api.getVideoData(videoId);
		return this.parseResponse(data, quality);
	}

	extractVideoId(url) {
		const match = url.match(
			/(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([^&\n?#]+)/
		);
		if (!match) {
			throw new Error("Invalid Youtube URL");
		}
		return match[1];
	}

	parseResponse(data, quality) {
		const { videoDetails, streamingData } = data;
		if (!videoDetails || !streamingData) {
			throw new Error("Invalid Youtube URL");
		}
		const formats = [].concat(
			streamingData.adaptiveFormats || [],
			streamingData.formats || []
		);

		return {
			title: videoDetails.title,
			author: videoDetails.author,
			shortDescription: videoDetails.shortDescription,
			thumbnail: this.getBestThumbnail(videoDetails.thumbnail.thumbnails),
			audio: MediaProcessor.processAudioFormats(
				formats,
				this.api.getCookieString()
			),
			video: MediaProcessor.processVideoFormats(
				formats,
				quality,
				this.api.getCookieString()
			),
		};
	}

	getBestThumbnail(thumbnails) {
		return thumbnails.reduce(
			(acc, curr) => (acc.width > curr.width ? acc : curr.url),
			thumbnails[0]
		);
	}
}
// const yt = new YouTube();
// yt.get("https://www.youtube.com/watch?v=DADQj4wcLNA", "480p").then((data) => {
// 	const { title, author, shortDescription, thumbnail, audio, video } = data;
// 	console.log({ title, author, shortDescription, thumbnail, audio, video });
// 	// audio.stream().pipe(fs.createWriteStream("audio.mp3"));
// 	// video.stream().pipe(fs.createWriteStream("video.mp4"));
// });
export default new YouTube();
