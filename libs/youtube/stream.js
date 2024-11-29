/** https://github.com/distubejs/ytdl-core/blob/master/lib/index.js */
import Miniget from "miniget";
import { PassThrough } from "stream";
import { CONFIG } from "./config.js";

class StreamHandler {
	static CHUNK_SIZE = 1024 * 1024 * 10;
	constructor(stream, input, cookie) {
		this.stream = stream;
		this.input = input;
		this.contentLength = 0;
		this.downloaded = 0;
		this.requestOptions = this.createRequestOptions(cookie);
	}

	createRequestOptions(cookie) {
		return {
			headers: {
				"User-Agent": CONFIG.USER_AGENT,
				cookie,
			},
			maxReconnects: 6,
			maxRetries: 3,
			backoff: { inc: 500, max: 10000 },
		};
	}

	handleData = (chunk) => {
		this.downloaded += chunk.length;
		this.stream.emit(
			"progress",
			chunk.length,
			this.downloaded,
			this.contentLength
		);
	};

	setupStreamEvents(req, end) {
		const events = [
			"abort",
			"request",
			"response",
			"error",
			"redirect",
			"retry",
			"reconnect",
		];
		events.forEach((event) => {
			req.prependListener(
				event,
				this.stream.emit.bind(this.stream, event)
			);
		});
		req.pipe(this.stream, { end });
	}

	async handleChunkedRequest(start, end, rangeEnd) {
		if (this.stream.destroyed) {
			return;
		}

		if (!rangeEnd && end >= this.contentLength) {
			end = 0;
		}

		const shouldEnd = !end || end === rangeEnd;
		this.requestOptions.headers.Range = `bytes=${start}-${end || ""}`;

		const req = Miniget(this.input.url, this.requestOptions);
		req.on("data", this.handleData);
		req.on("end", () => {
			if (this.stream.destroyed) {
				return;
			}
			if (end && end !== rangeEnd) {
				this.handleChunkedRequest(
					end + 1,
					end + StreamHandler.CHUNK_SIZE,
					rangeEnd
				);
			}
		});

		this.setupStreamEvents(req, shouldEnd);
	}

	handleRequest() {
		const req = Miniget(this.input.url, this.requestOptions);
		req.on("response", (res) => {
			if (this.stream.destroyed) {
				return;
			}
			this.contentLength = Number(res.headers.get("content-length"));
		});
		req.on("data", this.handleData);
		this.setupStreamEvents(req, true);
	}

	process() {
		if (this.input.isHLS || this.input.isDashMPD) {
			throw new Error("HLS and DASH streams are not supported yet.");
		}

		const shouldBeChunked =
			StreamHandler.CHUNK_SIZE !== 0 &&
			(!this.input.hasAudio || !this.input.hasVideo);

		if (shouldBeChunked) {
			this.contentLength = parseInt(this.input.contentLength);
			this.handleChunkedRequest(0, StreamHandler.CHUNK_SIZE, undefined);
		} else {
			this.handleRequest();
		}

		this.stream._destroy = () => {
			this.stream.destroyed = true;
		};
	}
}

export default (input, cookie) => {
	const stream = new PassThrough({ highWaterMark: 1024 * 512 });
	const handler = new StreamHandler(stream, input, cookie);
	handler.process();
	stream._destroy = () => {
		stream.destroyed = true;
	};
	return stream;
};
