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
		const [url, quality] = args;

		const { title, audio } = await youtube.get(url, quality);
		if (!audio) {
			return ctx.reply("Failed to get video");
		}

		const [, deleteMsg] = await ctx.reply(
			`Downloading audio *${title}* quality *${audio.quality}*...`
		);
		const stream = await audio.stream();
		// Probably dont work :/
		await ctx.sock.sendMessage(
			ctx.from,
			{
				// audio: {
				// 	stream,
				// },
				audio: { stream },
				fileName: `${title}.mp3`,
				mimetype: audio.mimeType,
			},
			{ quoted: ctx.message }
		);
		deleteMsg();
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
