import { Ffmpeg } from "../libs/converter/ffmpeg.js";
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
		const { title, author, audio } = await youtube.getInfo(ytUrl, {
			agent,
		});

		const [updateMsg] = await ctx.reply(`Downloading audio *${title}*...`);
		const stream = audio.download();
		stream.on("end", () => {
			updateMsg(`Sending audio *${title}*...`);
		});
		const buffer = await Ffmpeg(stream, {
			audioChannels: 1,
			audioCodec: "libopus",
			toFormat: "ogg",
			addOutputOptions: ["-avoid_negative_ts", "make_zero"],
		}).exec();

		await ctx.sock
			.sendMessage(
				ctx.from,
				{
					audio: buffer,
					fileName: `${title}.mp3`,
					mimetype: "audio/mpeg",
				},
				{ quoted: ctx.message }
			)
			.then(() => {
				updateMsg(`Author: *${author.name}*\nTitle: *${title}*`);
			});
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
