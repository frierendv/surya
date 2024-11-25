/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["instagram", "ig"],
	description: "Download Media from Instagram.",
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
			return ctx.reply("Please provide a Instagram link");
		}

		const { error, data } = await api.get("/instagram/download", {
			params: {
				query: {
					url,
				},
			},
		});
		if (error) {
			return ctx.reply(error.message || "Failed to fetch the data");
		}
		const { status, message, result } = data;
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
