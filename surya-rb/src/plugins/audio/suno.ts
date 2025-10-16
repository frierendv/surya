import { fetchClient } from "@/libs/fetch";
import { scheduler } from "@/libs/scheduler";
import type { IPlugin } from "@surya/plugin-manager";

const flag = {
	auto: "Automatic generation based on the prompt",
	lyrics: "Generate the song by lyrics provided",
} as const;

// a brief description
const description = `Generate a song using Suno AI.

Usage: *command <prompt | lyric>* [--flag]

Available options for --flag:
${Object.keys(flag)
	.map((f) => `\n- *--${f}*: ${flag[f as keyof typeof flag]}`)
	.join("")}

By default if no flag is provided, it will use 'auto' mode.

example:
- *command* I want a happy upbeat pop song about friendship.
- *command* --lyrics Here comes the sun, doo-doo-doo-doo, here comes the sun, and I say, it's all right.

Note: The generated song may take a few minutes to complete. You will receive the song here once it's ready. Please wait patiently.

> If previous song generation is still in progress and you start a new one, it will overwrite the previous task.
`;
export default {
	name: "suno-ai",
	command: ["suno", "suno-ai"],
	category: ["audio"],
	description,
	execute: async (ctx, { command, usedPrefix, sock }) => {
		if (!ctx.text) {
			return ctx.reply(
				`Please provide a prompt to generate a song.\nUsage: *${usedPrefix}${command} <prompt>* [--flag]\n\nAvailable options for --flag:\n${Object.keys(
					flag
				)
					.map((f) => `\n- *--${f}*: ${flag[f as keyof typeof flag]}`)
					.join("")}`
			);
		}
		let flagOption = "auto" as keyof typeof flag;
		const regex = /--(\w+)\s+([\w-]+)/g;
		let match;
		while ((match = regex.exec(ctx.text))) {
			const [, key, value] = match;
			if (!key) {
				continue;
			}
			flagOption = value as keyof typeof flag;
		}
		const text = ctx.quoted?.text || ctx.text.replace(regex, "").trim();
		if (!Object.keys(flag).includes(flagOption)) {
			return ctx.reply(
				`Invalid option. Available options are: ${Object.keys(flag)
					.map((f) => `\n- *--${f}*: ${flag[f as keyof typeof flag]}`)
					.join("")}`
			);
		}

		const { editReply } = await ctx.reply(
			"Generating your song, please wait..."
		);

		const requestOptions: Record<string, any> = {
			mode: "auto",
			prompt: text,
			model_version: "v3.5",
		};
		if (flagOption === "lyrics") {
			requestOptions.mode = "lyrics";
			requestOptions.lyrics = text;
			delete requestOptions.prompt;
		}

		const { value, error } = await fetchClient.post(
			"/ai_song/submit_task",
			requestOptions as any
		);
		if (error) {
			return editReply(
				`Failed to generate song: ${error.message || "Unknown error"}`
			);
		}
		const { status: rspStatus, result, message } = value!.data;
		if (!rspStatus || !result) {
			return editReply(message);
		}
		if (!Array.isArray(result) || !result.length) {
			return editReply("No song generated, please try again later.");
		}

		// song id
		const songIds = result!.map((song) => song.song_id!).filter(Boolean);
		if (!songIds.length) {
			return editReply(
				"No song has been generated, please try again later."
			);
		}
		// suno generate 2 songs with same lyrics, title, tags, so we just pick the first one
		const songMeta = result.find((s) => s.song_id === songIds[0]);
		const messageLines = [
			"Song generation task submitted successfully!",
			`*Title:* ${songMeta?.title || "N/A"}`,
			`*Tags:* ${songMeta?.tags || "N/A"}\n`,
			// missing lyric field in api response type
			(songMeta as any)?.lyric ?? (songMeta as any)?.prompt,
		];
		const msg = await editReply(messageLines.join("\n"));

		void scheduler.interval.add(
			`${ctx.sender}:suno-ai`,
			5000,
			"fetch-suno-song-status",
			{
				from: ctx.from,
				sender: ctx.sender,
				songIds,
				quoted: {
					key: msg!.key,
					message: msg!.message,
				},
			},
			{ backoffMs: 1000, maxRetries: 3 }
		);
		await sock.sendMessage(
			ctx.from,
			{
				text: "You will receive the generated song(s) here once it's ready. *Please wait patiently.*",
			},
			{ quoted: msg }
		);
	},
} satisfies IPlugin;
