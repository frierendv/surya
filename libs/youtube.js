// TODO: VIDEO MP4
import { Y2Mate } from "./youtube/y2mate.js";

export class YouTube {
	constructor() {
		this.api = new Y2Mate();
	}

	async get(url) {
		const videoId = this.extractVideoId(url);
		const data = await this.api.analyze(url);
		return {
			thumbnail: this.createThumbnail(videoId),
			...data,
		};
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

	createThumbnail(videoId) {
		return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
	}
}

export default new YouTube();
