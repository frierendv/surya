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
		const agent = process.env.PROXY
			? youtube.createProxyAgent({
					uri: process.env.PROXY,
				})
			: undefined;
		const { title, audio } = await youtube.getInfo(ytUrl, {
			agent,
		});

		const [, deleteMsg] = await ctx.reply(
			`Downloading audio *${title}*...`
		);
		const stream = audio.download();
		await ctx.sock.sendMessage(
			ctx.from,
			{
				audio: { stream },
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
