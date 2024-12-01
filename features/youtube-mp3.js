import youtube from "../libs/youtube.js";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["ytmp3"],
	description: "Download youtube video as mp3",
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

		const { title, audio } = await youtube.get(ytUrl);
		if (!audio || !audio.mp3) {
			return ctx.reply("Failed to get video");
		}

		const [, deleteMsg] = await ctx.reply(
			`Downloading audio *${title}* quality *${audio.quality}*...`
		);
		const url = await audio.mp3.get();
		await ctx.sock.sendMessage(
			ctx.from,
			{
				audio: { url },
				fileName: `${title}.mp3`,
			},
			{ quoted: ctx.message }
		);
		deleteMsg();
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
