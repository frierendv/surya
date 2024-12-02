import { fetch } from "undici";
import { CONFIG } from "./config.js";

export class Y2Mate {
	constructor() {
		this.fetch = fetch;
	}

	async convert(videoId, key) {
		try {
			const response = await this._makeRequest("/mates/convertV2/index", {
				vid: videoId,
				k: key,
			});

			if (response.c_status !== "CONVERTED") {
				throw new Error("Conversion failed");
			}
			return response.dlink;
		} catch (error) {
			console.error(`Conversion failed: ${error.message}`);
			throw new Error("Conversion failed");
		}
	}

	async analyze(url) {
		const params = {
			k_query: url,
			k_page: "home",
			hl: "en",
			q_auto: "0",
		};

		try {
			const response = await this._makeRequest(
				"/mates/analyzeV2/ajax",
				params
			);
			return {
				title: response.title,
				video: this._processLinks(response.links.mp4, response.vid),
				audio: this._processLinks(response.links.mp3, response.vid),
			};
		} catch (error) {
			console.error(`Analysis failed: ${error.message}`);
			throw new Error("Analysis failed");
		}
	}

	async _makeRequest(endpoint, params) {
		try {
			const body = new URLSearchParams(params);
			const response = await this.fetch(`${CONFIG.BASE_URL}${endpoint}`, {
				method: "POST",
				body,
				headers: CONFIG.DEFAULT_HEADERS,
			});
			return response.json();
		} catch (error) {
			throw new Error(`Request failed: ${error.message}`);
		}
	}

	_createKey(quality) {
		return CONFIG.QUALITY.includes(quality) ? quality : null;
	}

	_processLinks(links, videoId) {
		if (!links || !videoId) {
			return {};
		}

		return Object.values(links)
			.filter((link) => link?.k)
			.reduce((acc, { f: type, q: quality, size, k: key }) => {
				const processedKey = this._createKey(quality) || type;
				acc[processedKey] = {
					type,
					quality,
					size: size || quality,
					get: async () => this.convert(videoId, key),
				};
				return acc;
			}, {});
	}
}
