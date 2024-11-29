import stream from "./stream.js";
import FORMATS from "./ytdl-format.js";

export class MediaProcessor {
	static formatMetadata(format) {
		return {
			...format,
			...FORMATS[format.itag],
			hasVideo: !!format.qualityLabel,
			hasAudio: !!format.audioBitrate || !!format.audioQuality,
			codecs: format.mimeType
				? format.mimeType.match(/codecs="(.*)"/)[1]
				: "",
			isLive: /\bsource[/=]yt_live_broadcast\b/.test(format.url),
			isHLS: /\/manifest\/hls_(variant|playlist)\//.test(format.url),
			isDashMPD: /\/manifest\/dash\//.test(format.url),
			url: format.url,
			quality: format.qualityLabel || format.audioQuality,
		};
	}

	static sortByBitrate(audioFormats) {
		const audioBitrate = audioFormats.map((a) => a.audioBitrate).sort();
		return audioFormats.sort((a, b) => {
			return (
				audioBitrate.indexOf(a.audioBitrate) -
				audioBitrate.indexOf(b.audioBitrate)
			);
		});
	}
	static selectBestAudioFormat(sortedAudio) {
		const medium = sortedAudio[Math.floor(sortedAudio.length / 2)];
		return (
			sortedAudio.find((a) => a.quality === "AUDIO_QUALITY_HIGH") ||
			sortedAudio.find((a) => a.quality === "AUDIO_QUALITY_MEDIUM") ||
			medium
		);
	}
	static processAudioFormats(formats, cookieString) {
		const audioFormats = formats
			.filter((f) => f.mimeType.includes("audio"))
			.map(this.formatMetadata);

		const sortedAudio = this.sortByBitrate(audioFormats);
		const selectedAudio = this.selectBestAudioFormat(sortedAudio);

		return {
			...selectedAudio,
			stream: () => stream(selectedAudio, cookieString),
		};
	}

	static sortByResolution(videoFormats) {
		const resolutions = videoFormats.map((v) => v.quality).sort();
		return videoFormats.sort((a, b) => {
			return (
				resolutions.indexOf(a.resolution) -
				resolutions.indexOf(b.resolution)
			);
		});
	}
	static processVideoFormats(formats, quality, cookieString) {
		const videoFormats = formats.map(this.formatMetadata);
		const sortedVideos = this.sortByResolution(videoFormats);
		const selectedVideo = quality
			? sortedVideos.find((v) => v.quality === quality)
			: sortedVideos[Math.floor(sortedVideos.length / 2)];

		return {
			...selectedVideo,
			stream: () => stream(selectedVideo, cookieString),
		};
	}
}
