import { fetchClient } from "@libs/fetch";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "tiktok-downloader",
	command: ["tiktok", "tk", "tt"],
	category: ["downloader"],
	description: "Download TikTok media without watermark.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const url = ctx.args?.[0];
		if (!url) {
			await ctx.reply(
				`Please provide a TikTok URL.\nUsage: *${usedPrefix}${command}* <TikTok URL>`
			);
			return;
		}
		const { error, data } = await fetchClient.GET("/tiktok/get_content", {
			params: { query: { url } },
		});
		if (error) {
			await ctx.reply(`Failed to fetch content: ${error.message}`);
			return;
		}
		const { status, message, result } = data;
		if (!status || !result) {
			return ctx.reply(message);
		}
		for (const url of result.images && result.images
			? [...result.images]
			: [result.video_url ?? result.watermarked_video_url]) {
			await sock.sendFile(ctx.from, url, { quoted: ctx });
		}
		if (result.images && result.music) {
			await sock.sendMessage(
				ctx.from,
				{
					audio: { url: result.music.play_url! },
					mimetype: "audio/mp4",
				},
				{ quoted: ctx }
			);
		}
	},
} satisfies IPlugin;
