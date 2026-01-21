import type { IPlugin } from "@surya/plugin-manager";

type MediaKey = "video" | "audio";
interface IMedia {
	filename: string;
	url: string;
	mime_type: string;
}
interface IYoutubeMeta {
	id: string;
	title: string;
	fulltitle: string;
	description: string;
	tags: string[];
	thumbnail: string;
	duration: number;
	view_count: string;
	like_count: string;
}

type YoutubeInfo<T extends MediaKey = "video"> = IYoutubeMeta & {
	[K in T]: IMedia;
} & {
	[K in Exclude<MediaKey, T>]?: never;
};
type APIResponse<T extends MediaKey> = { message: string } & (
	| { status: true; result: YoutubeInfo<T> }
	| { status: false; result: null }
);

export default {
	name: "youtube-downloader",
	command: ["youtube", "ytmp4", "ytmp3"],
	category: ["downloader"],
	description: "Download video or audio from youtube",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const url = ctx.args?.[0];
		if (!url) {
			await ctx.reply(
				`Please provide a valid Instagram URL.\nUsage: *${usedPrefix}${command}* <Instagram URL>`
			);
			return;
		}
		const mediaKey: MediaKey = command === "ytmp3" ? "audio" : "video";
		const mediaQuality = mediaKey === "video" ? "480" : "mp3";
		const options = {
			url,
			[mediaKey]: mediaQuality,
		};
		const response = await fetch(
			"https://api.apigratis.cc/downloader/youtube",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(options),
			}
		);
		if (!response.ok) {
			return ctx.reply("Failed retrieve youtube information.");
		}
		const { status, message, result } =
			(await response.json()) as unknown as APIResponse<typeof mediaKey>;
		if (!status) {
			return ctx.reply(
				message || `Failed to download youtube ${mediaKey} content.`
			);
		}
		const caption = [
			`Title: ${result?.title}`,
			`Tags: ${(result?.tags || []).join(" ")}\n`,
			result.description,
		]
			.join("\n")
			.trimEnd();

		/**
		 * sock.sendMessage(ctx.from, { [mediaKey]: result[mediaKey] } as any);
		 */
		await sock.sendFile(ctx.from, result[mediaKey].url, {
			fileName:
				(result?.title ?? result.id) + mediaKey === "audio"
					? ".mp3"
					: ".mp4",
			...(mediaKey === "audio" ? { ptt: false } : { caption }),
		});
	},
} satisfies IPlugin;
