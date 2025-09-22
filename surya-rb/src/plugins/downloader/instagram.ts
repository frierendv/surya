import { fetchClient } from "@libs/fetch";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "instagram-downloader",
	command: ["instagram", "igdl", "ig"],
	category: ["downloader"],
	description: "Download media from Instagram posts, reels, and IGTV.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const url = ctx.args?.[0];
		if (!url) {
			await ctx.reply(
				`Please provide a valid Instagram URL.\nUsage: *${usedPrefix}${command}* <Instagram URL>`
			);
			return;
		}
		const { error, data } = await fetchClient.GET(
			"/instagram/get_content",
			{
				params: { query: { url } },
			}
		);
		if (error) {
			await ctx.reply(`Failed to fetch content: ${error.message}`);
			return;
		}
		const { status, message, result } = data;
		if (!status || !result?.contents) {
			return ctx.reply(message);
		}
		for (const { url } of result.contents) {
			await sock.sendFile(ctx.from, url, { quoted: ctx });
		}
	},
} satisfies IPlugin;
