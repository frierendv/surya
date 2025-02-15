// https://github.com/distubejs/ytdl-core/blob/master/lib/index.js
import * as YtdlUtils from "@distube/ytdl-core/lib/utils.js";
import miniget from "miniget";
import { PassThrough } from "stream";

const createStream = () => {
	const stream = new PassThrough({
		highWaterMark: 1024 * 512,
	});
	stream._destroy = () => {
		stream.destroyed = true;
	};
	return stream;
};

/**
 *
 * @param {miniget.Stream} req
 * @param {ReturnType<createStream>} stream
 * @param {boolean} [end]
 */
const pipeAndSetEvents = (req, stream, end) => {
	// Forward events from the request to the stream.
	[
		"abort",
		"request",
		"response",
		"error",
		"redirect",
		"retry",
		"reconnect",
	].forEach((event) => {
		req.prependListener(event, stream.emit.bind(stream, event));
	});
	req.pipe(stream, { end });
};

/**
 *
 * @param {ReturnType<createStream>} stream
 * @param {import("@distube/ytdl-core").videoFormat} format
 * @param {Object} [options]
 */
const downloadFromInfoCallback = (stream, format, options) => {
	options = options || {};
	let contentLength,
		downloaded = 0;
	const ondata = (chunk) => {
		downloaded += chunk.length;
		stream.emit("progress", chunk.length, downloaded, contentLength);
	};

	// Download the file in chunks, in this case the default is 10MB,
	// anything over this will cause youtube to throttle the download
	const dlChunkSize = 1024 * 1024 * 10;
	let req;
	let shouldEnd = true;

	YtdlUtils.applyDefaultHeaders(options);
	if (options.agent) {
		// Set agent on both the miniget and m3u8stream requests
		options.requestOptions.agent = options.agent.agent;

		if (options.agent.jar) {
			YtdlUtils.setPropInsensitive(
				options.requestOptions.headers,
				"cookie",
				options.agent.jar.getCookieStringSync("https://www.youtube.com")
			);
		}
		if (options.agent.localAddress) {
			options.requestOptions.localAddress = options.agent.localAddress;
		}
	}
	/** @type {miniget.Options} */
	const requestOptions = Object.assign({}, options.requestOptions, {
		maxReconnects: 6,
		maxRetries: 3,
		backoff: { inc: 500, max: 10000 },
	});
	if (requestOptions?.agent) {
		// This fix ERR_TLS_CERT_ALTNAME_INVALID https://github.com/distubejs/ytdl-core/issues/58
		requestOptions.headers = Object.assign({}, requestOptions.headers, {
			host: new URL(format.url).host,
		});
	}

	let shouldBeChunked =
		dlChunkSize !== 0 && (!format.hasAudio || !format.hasVideo);

	if (shouldBeChunked) {
		let start = 0;
		let end = start + dlChunkSize;
		const rangeEnd = 0;

		contentLength = parseInt(format.contentLength);

		const getNextChunk = () => {
			if (stream.destroyed) {
				return;
			}
			if (!rangeEnd && end >= contentLength) {
				end = 0;
			}
			if (rangeEnd && end > rangeEnd) {
				end = rangeEnd;
			}
			shouldEnd = !end || end === rangeEnd;

			requestOptions.headers = Object.assign({}, requestOptions.headers, {
				Range: `bytes=${start}-${end || ""}`,
			});
			req = miniget(format.url, requestOptions);
			req.on("data", ondata);
			req.on("end", () => {
				if (stream.destroyed) {
					return;
				}
				if (end && end !== rangeEnd) {
					start = end + 1;
					end += dlChunkSize;
					getNextChunk();
				}
			});
			pipeAndSetEvents(req, stream, shouldEnd);
		};
		getNextChunk();
	} else {
		req = miniget(format.url, requestOptions);
		req.on("response", (res) => {
			if (stream.destroyed) {
				return;
			}
			contentLength =
				contentLength || parseInt(res.headers["content-length"]);
		});
		req.on("data", ondata);
		pipeAndSetEvents(req, stream, shouldEnd);
	}

	stream._destroy = () => {
		stream.destroyed = true;
		if (req) {
			req.destroy();
			req.end();
		}
	};
};

export { createStream, pipeAndSetEvents, downloadFromInfoCallback };
