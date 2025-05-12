/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["tiktok", "tt"],
	description: "Download Media from TikTok.",
	category: "Downloader",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { sock, api, args }) {
		const url = args[0];
		if (!url) {
			return ctx.reply("Please provide a Tiktok link");
		}
		// @ts-ignore
		const { error, data } = await api.get("/tiktok/get_content", {
			params: {
				query: {
					url,
				},
			},
		});
		if (error) {
			return ctx.reply(error.message || "Failed to fetch the data");
		}
		// @ts-ignore
		const { status, message, result } = data;
		if (!status || !result) {
			return ctx.reply(message);
		}
		for (const url of result.images && result.images
			? [...result.images]
			: [result.video_url ?? result.watermarked_video_url]) {
			await sock.sendFile(
				ctx.from,
				// @ts-ignore
				url,
				{ quoted: ctx }
			);
		}
		if (result.images && result.music) {
			await sock.sendMessage(
				ctx.from,
				// @ts-ignore
				{
					audio: { url: result.music.play_url },
					mimetype: "audio/mp4",
				},
				{ quoted: ctx.message }
			);
		}
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
