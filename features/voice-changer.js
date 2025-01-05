/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["vc", "voice-change"],
	description: "Change voice from audio",
	category: "Audio",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { api, text, prefix }) {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/audio/i.test(media.mimetype)) {
			return ctx.reply(
				`Reply/send audio with *${prefix + this.command}*`
			);
		}
		const options = {
			voice_id: "EXAVITQu4vr4xnSDxMaL",
			model_id: "eleven_multilingual_sts_v2",
		};
		const regex = /--(\w+)\s+([\w-]+)/g;
		let match;
		while ((match = regex.exec(text))) {
			const [, key, value] = match;
			options[key] = value;
		}

		const buffer = await media.download();

		const form = new FormData();
		const blob = new Blob([buffer], { type: media.mimetype });
		form.append("audio", blob, "audio.mp3");
		for (const key in options) {
			form.append(key, options[key]);
		}

		const { data, error } = await api.post(
			"/tts/inference_voice",
			{
				body: form,
			},
			{
				headers: {
					"Content-Type": "multipart/form-data",
				},
			}
		);

		if (error) {
			return ctx.reply(
				`Failed to execute the ${this.command} command\n${error.message}`
			);
		}
		const { status, result, message } = data;
		if (!status || !result?.audios) {
			return ctx.reply(message);
		}

		await ctx.sock.sendMessage(
			ctx.from,
			{
				audio: {
					url: result.audios[0],
				},
				mimetype: "audio/mp4",
			},
			{ quoted: ctx.message }
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
