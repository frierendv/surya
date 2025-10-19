import { fetchClient } from "@/libs/fetch";
import { scheduler } from "@/libs/scheduler";
import type { IPlugin } from "@surya/plugin-manager";

const flag = {
	auto: "Automatic generation based on the prompt",
	lyrics: "Generate the song by lyrics provided",
	female: "Generate a song with female vocals",
	male: "Generate a song with male vocals",
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
	execute: async (ctx, { command, usedPrefix }) => {
		if (!ctx.text) {
			return ctx.reply(
				`Please provide a prompt to generate a song. type *${usedPrefix}help ${command}* for more information.`
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
			model: "v4.5",
		};
		if (flagOption === "lyrics") {
			requestOptions.mode = "custom";
			requestOptions.lyrics = text;
			delete requestOptions.prompt;
		}
		if (flagOption === "female" || flagOption === "male") {
			requestOptions.gender = flagOption;
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
		if (!result?.task_ids?.length) {
			return editReply("No song generated, please try again later.");
		}

		// song id
		const taskId = result?.task_ids!.map((tid) => tid).filter(Boolean);
		if (!taskId.length) {
			return editReply(
				"No song has been generated, please try again later."
			);
		}

		void scheduler.interval.add(
			`${ctx.sender}:suno-ai`,
			5000,
			"fetch-suno-song-status",
			{
				from: ctx.from,
				sender: ctx.sender,
				taskId,
				quoted: {
					key: ctx.key,
					message: ctx.message,
				},
			},
			{ backoffMs: 1000, maxRetries: 3 }
		);
		await editReply(
			"You will receive the generated song(s) here once it's ready. *Please wait patiently.*"
		);
	},
} satisfies IPlugin;
