import { ProxyAgent, fetch } from "undici";
import { convertAudio } from "../libs/converter/convert.js";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["fetch", "get"],
	description: "Fetch a url",
	category: "Utility",
	owner: false,
	hidden: false,
	admin: false,
	group: false,
	limit: false,
	private: false,

	execute: async function (ctx, { text }) {
		if (!text) {
			return await ctx.reply("Please provide a url");
		}
		let dispatcher;

		if (process.env.PROXY) {
			dispatcher = new ProxyAgent(process.env.PROXY);
		}

		const url = new URL(text);

		const response = await fetch(url, {
			method: "GET",
			dispatcher,
		});
		const { status, headers } = response;

		if (status !== 200) {
			return `Failed to fetch ${url}\nStatus code: ${status}`;
		}
		const quoted = { quoted: ctx.message };
		const contentType = headers.get("content-type");

		// if is media
		const mediaType = contentType?.split("/")[0];
		if (mediaType && ["image", "video", "audio"].includes(mediaType)) {
			let buffer = await response.arrayBuffer();

			if (mediaType === "audio") {
				// @ts-ignore
				buffer = await convertAudio(Buffer.from(buffer));
			}
			return await ctx.sock.sendMessage(
				ctx.from,
				// @ts-ignore
				{
					[mediaType]: Buffer.from(buffer),
				},
				quoted
			);
		}
		// is json
		if (contentType === "application/json") {
			const json = await response.json();
			return await ctx.reply(JSON.stringify(json, null, 2));
		}

		const _text = await response.text();
		if (_text.length > 500 * 1024) {
			return await ctx.sock.sendMessage(
				ctx.from,
				{
					document: Buffer.from(_text),
					mimetype: "text/plain",
					fileName: url.pathname.split("/").pop(),
				},
				quoted
			);
		}
		await ctx.reply(_text);
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
