import { fetchClient } from "@/libs/fetch";
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
		const { error, value } = await fetchClient.get("/tiktok/get_content", {
			queryParams: { url },
		});
		if (error) {
			await ctx.reply(`Failed to fetch content: ${error?.message}`);
			return;
		}
		const { status, message, result } = value!.data;
		if (!status || !result) {
			return ctx.reply(message);
		}
		for (const url of result.images && result.images
			? [...result.images]
			: [result.video_url ?? result.watermarked_video_url]) {
			await sock.sendFile(ctx.from, url, { quoted: ctx });
		}
		if (result.images && result.music) {
			await sock.sendFile(ctx.from, result.music.play_url!, {
				ptt: false,
				quoted: ctx,
			});
		}
	},
} satisfies IPlugin;
