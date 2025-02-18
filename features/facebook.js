import { request } from "undici";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["facebook", "fb"],
	description: "Download Media from Facebook",
	category: "Downloader",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { sock, args }) {
		const url = args[0];
		if (!url) {
			return ctx.reply("Please provide a Facebook link");
		}

		const { body, statusCode } = await request(
			"https://api.apigratis.tech/downloader/facebook?" +
				new URLSearchParams({ url: "x" }),
			{}
		);
		if (statusCode !== 200) {
			return ctx.reply("Failed to fetch the data");
		}
		// @ts-ignore
		const { status, message, result } = await body.json();
		if (!status || !result?.contents) {
			return ctx.reply(message);
		}

		for (const { url } of result.contents) {
			// @ts-ignore
			await sock.sendFile(ctx.from, url, { quoted: ctx });
		}
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
