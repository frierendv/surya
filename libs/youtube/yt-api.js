import axios from "axios";
import { fetch, setGlobalOrigin } from "undici";
import { CONFIG } from "./config.js";

export class YouTubeAPI {
	constructor() {
		// this.fetch = fetch;
		this.currentCookies = {};
		// setGlobalOrigin(CONFIG.BASE_URL);
		this.fetch = axios.create({
			baseURL: CONFIG.BASE_URL,
			headers: {
				"User-Agent": CONFIG.USER_AGENT,
			},
		});
	}

	async makeRequest(path, options) {
		const { headers } = options;
		// return this.fetch(path, {
		// 	...options,
		// 	headers: {
		// 		...headers,
		// 		"User-Agent": CONFIG.USER_AGENT,
		// 		cookie: this.getCookieString(),
		// 	},
		// });
		return this.fetch(path, {
			...options,
			headers: {
				...headers,
				cookie: this.getCookieString(),
			},
		});
	}

	async getVideoData(videoId) {
		const response = await this.makeRequest(
			`/watch?v=${videoId}&bpctr=9999999999&has_verified=1`,
			{
				method: "GET",
			}
		);
		this.updateCookies(response.headers);
		// const text = await response.text()
		// const match = text.match(/var ytInitialPlayerResponse = ({.*?});/);
		// if (match) {
		// 	try {
		// 		return JSON.parse(match[1]);
		// 	} catch {
		// 		// no-op
		// 	}
		// }
		return this.postVideoData(videoId);
	}

	async postVideoData(videoId) {
		const response = await this.makeRequest(
			"/youtubei/v1/player?prettyPrint=false",
			{
				method: "POST",
				// body: JSON.stringify(this.createRequestBody(videoId)),
				data: this.createRequestBody(videoId),
				headers: {
					Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
					Cookie: this.getCookieString(),
					"Content-Type": "application/json",
					"User-Agent": CONFIG.CLIENT_CONFIG.userAgent,
					"X-Youtube-Client-Name": "5",
					"X-Youtube-Client-Version": "19.29.1",
				},
			}
		);
		return response.data;
	}

	updateCookies(headers) {
		// const cookies = headers.get("set-cookie");
		const cookies = headers["set-cookie"].join("; ");
		if (!cookies) {
			return;
		}

		CONFIG.REQUIRED_COOKIES.forEach((cookieName) => {
			const match = cookies.match(new RegExp(`${cookieName}=(.*?);`));
			if (match) {
				this.currentCookies[cookieName] = match[1];
			}
		});
	}

	getCookieString() {
		return Object.entries(this.currentCookies)
			.map(([key, value]) => `${key}=${value}`)
			.join("; ");
	}

	createRequestBody(videoId) {
		return {
			context: {
				client: CONFIG.CLIENT_CONFIG,
			},
			playbackContext: {
				contentPlaybackContext: {
					html5Preference: "HTML5_PREF_WANTS",
				},
			},
			contentCheckOk: true,
			racyCheckOk: true,
			videoId,
			request: {
				internalExperimentFlags: [],
				useSsl: true,
			},
			user: {
				lockedSafetyMode: false,
			},
		};
	}
}
