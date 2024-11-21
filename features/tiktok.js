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

	execute: async function (m, { sock, api, args }) {
		const url = args[0];
		if (!url) {
			return m.reply("Please provide a Tiktok link");
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
			return m.reply(error.message || "Failed to fetch the data");
		}
		// @ts-ignore
		const { status, message, result } = data;
		if (!status || !result) {
			return m.reply(message);
		}
		const { type: _type, download } = result;
		const type = _type === "images" ? "image" : "video";
		for (const url of type === "image"
			? [...download.images]
			: [download.nowm ?? download.wm]) {
			await sock.sendMessage(
				m.from,
				// @ts-ignore
				{
					// @ts-ignore
					[type]: { url },
				},
				{ quoted: m.message }
			);
		}
		if (type === "image" && download?.music) {
			await sock.sendMessage(
				m.from,
				// @ts-ignore
				{
					audio: { url: download.music },
					mimetype: "audio/mp4",
				},
				{ quoted: m.message }
			);
		}
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
