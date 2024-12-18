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
		const { error, data } = await api.get("/tiktok/get", {
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
		const { type: _type, download } = result;
		if (!download) {
			return ctx.reply("Failed to fetch the data");
		}
		const type = _type === "images" ? "image" : "video";
		for (const url of type === "image" && download.images
			? [...download.images]
			: [download.nowm ?? download.wm]) {
			await sock.sendFile(
				ctx.from,
				// @ts-ignore
				url,
				{ quoted: ctx }
			);
		}
		if (type === "image" && download.music) {
			await sock.sendMessage(
				ctx.from,
				// @ts-ignore
				{
					audio: { url: download.music },
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
