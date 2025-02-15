import youtube from "../libs/youtube.js";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["ytmp4"],
	description: "Download youtube video as mp4",
	category: "Downloader",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { args }) {
		if (!args[0]) {
			return ctx.reply("Please provide a youtube link");
		}
		const [ytUrl] = args;

		const agent = process.env.PROXY
			? youtube.createProxyAgent({
					uri: process.env.PROXY,
				})
			: undefined;

		const { title, author, video } = await youtube.getInfo(ytUrl, {
			agent,
		});

		const [updateMsg] = await ctx.reply(`Downloading video *${title}*...`);
		const stream = video.download();
		stream.on("end", () => {
			updateMsg(`Sending video *${title}*...`);
		});
		await ctx.sock
			.sendMessage(
				ctx.from,
				{
					video: { stream },
					caption: title,
					fileName: `${title}.mp4`,
				},
				{ quoted: ctx.message }
			)
			.then(() => {
				updateMsg(`Author: *${author}*\nTitle: *${title}*`);
			});
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
