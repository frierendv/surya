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

		const { title, video } = await youtube.get(ytUrl);
		if (!video || !video.auto) {
			return ctx.reply("Failed to get video");
		}

		const [, deleteMsg] = await ctx.reply(
			`Downloading video *${title}*...`
		);
		const url = await video.auto.get();
		await ctx.sock.sendMessage(
			ctx.from,
			{
				video: { url },
				caption: title,
				fileName: `${title}.mp4`,
			},
			{ quoted: ctx.message }
		);
		deleteMsg();
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};