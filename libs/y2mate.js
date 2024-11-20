// @ts-nocheck
import { fetch } from "undici";

export class Y2Mate {
	constructor() {
		this.baseURL = "https://www.y2mate.com";
		this.headers = {
			accept: "*/*",
			"accept-language":
				"en-US,en;q=0.9,id;q=0.8,en-GB;q=0.7,en-GB-oxendict;q=0.6",
			"cache-control": "no-cache",
			"content-type": "application/x-www-form-urlencoded; charset=UTF-8",
			pragma: "no-cache",
			"sec-ch-ua":
				'"Not A(Brand";v="99", "Microsoft Edge";v="121", "Chromium";v="121"',
			"sec-ch-ua-arch": '"x86"',
			"sec-ch-ua-bitness": '"64"',
			"sec-ch-ua-full-version": '"121.0.2277.128"',
			"sec-ch-ua-full-version-list":
				'"Not A(Brand";v="99.0.0.0", "Microsoft Edge";v="121.0.2277.128", "Chromium";v="121.0.6167.184"',
			"sec-ch-ua-mobile": "?0",
			"sec-ch-ua-model": '""',
			"sec-ch-ua-platform": '"Windows"',
			"sec-ch-ua-platform-version": '"15.0.0"',
			"sec-fetch-dest": "empty",
			"sec-fetch-mode": "cors",
			"sec-fetch-site": "same-origin",
			"sec-gpc": "1",
			"x-requested-with": "XMLHttpRequest",
			Referer: "https://www.y2mate.com/",
			"Referrer-Policy": "strict-origin-when-cross-origin",
		};
		this.mapTypes = ["mp3", "360p", "480p", "720p", "1080p"];
	}

	filter(obj) {
		return Object.keys(obj).reduce((filtered, key) => {
			if (this.mapTypes.includes(key)) {
				filtered[key] = {
					size: obj[key]["size"],
					ext: obj[key]["f"],
					k: obj[key]["k"],
				};
			}
			return filtered;
		}, {});
	}

	async _doConvert(vid, k) {
		const resp = await fetch(`${this.baseURL}/mates/convertV2/index`, {
			headers: this.headers,
			body: new URLSearchParams({ vid, k }),
			method: "POST",
		});
		return resp.json();
	}

	async _toBuffer(url) {
		const resp = await fetch(url);
		const arrayBuffer = await resp.arrayBuffer();
		return Buffer.from(arrayBuffer);
	}

	async info(url) {
		const resp = await fetch(`${this.baseURL}/mates/analyzeV2/ajax`, {
			headers: this.headers,
			body: new URLSearchParams({
				k_query: url,
				k_page: "home",
				hl: "en",
				h_auto: "0",
			}),
			method: "POST",
		});
		const data = await resp.json();
		const { title, a: author, links, vid, c_status } = data;

		if (c_status === "FAILED") {
			return { error: true, message: "Failed to download the video" };
		}

		const filter = {
			mp3: this.filter(links["mp3"]),
			mp4: this.filter(links["mp4"]),
		};

		for (const key in filter) {
			for (const k in filter[key]) {
				const d = await this._doConvert(vid, filter[key][k]["k"]);
				filter[key][k] = {
					size: filter[key][k]["size"],
					download: () => this._toBuffer(d["dlink"]),
				};
			}
		}
		return { title, author, urls: filter };
	}
}

export default new Y2Mate();
