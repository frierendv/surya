import { fetchClient } from "@/libs/fetch";
import { scheduler } from "@/libs/scheduler";
import type { IPlugin } from "@surya/plugin-manager";

const stemsOptions = [
	"vocals_instrumental",
	"voice_drums_bass_others",
	"voice_drums_bass_others_v2",
];

// a brief description
const description = `Remove vocals or isolate vocals from an audio file using AI.

Usage: *command* <stems>


Available options for <stems>:
- vocals_instrumental: Separate into vocals and instrumental.
- voice_drums_bass_others: Separate into voice, drums, bass, and others.
- voice_drums_bass_others_v2: Improved voice/drums/bass/others separation.

By default if no option is provided, it will use 'vocals_instrumental' mode.

example:
- *command* vocals_instrumental
- *command* voice_drums_bass_others

You can reply to an audio.

Note: The unmixing process may take a few minutes to complete. You will receive the audio here once it's ready. Please wait patiently.

> If previous unmixing task is still in progress and you start a new one, it will overwrite the previous task.
`;
export default {
	name: "unmix",
	command: ["unmix"],
	category: ["audio"],
	description,
	execute: async (ctx, { command, usedPrefix }) => {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/audio/i.test(media.mimetype)) {
			return ctx.reply(
				`Please reply/send an audio file. Type *${usedPrefix}help ${command}* for more information.`
			);
		}
		const stems = ctx.args[0]?.toLowerCase() || "vocals_instrumental";
		if (!stemsOptions.includes(stems)) {
			return ctx.reply(
				`Invalid stems option. Available options are:\n- ${stemsOptions.join("\n- ")}`
			);
		}
		const buffer = await media.download();
		const fd = new FormData();
		const blob = new Blob([new Uint8Array(buffer)], {
			type: media.mimetype,
		});
		fd.append("init_audio", blob, `audio_${crypto.randomUUID()}.mp3`);
		fd.append("stems", stems);

		const { editReply } = await ctx.reply(
			"Submitting your unmixing task, please wait..."
		);
		const { error, value } = await fetchClient.post(
			"/unmix/submit_task",
			fd as any,
			{
				headers: {
					"Content-Type": `multipart/form-data; boundary=${fd.getBoundary()}`,
				},
			}
		);
		if (error) {
			return editReply(
				`Failed to generate song: ${error.message || "Unknown error"}`
			);
		}
		const { status, result, message } = value!.data;
		if (!status || !result) {
			return editReply(message);
		}
		const { task_id: taskId } = result;
		if (!taskId) {
			return editReply("Failed to get task ID. Please try again later.");
		}

		void scheduler.interval.add(
			`${ctx.sender}:unmix`,
			5000,
			"fetch-unmix-status",
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
			"Your unmixing task has been submitted successfully!. You will receive the audio here once it's ready. Please wait patiently."
		);
	},
} satisfies IPlugin;
