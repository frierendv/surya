/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["tts"],
	description: "Text to speech",
	category: "Audio",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { api, prefix, text: _text }) {
		if (!_text && !ctx.quoted) {
			return ctx.reply(`Usage: ${prefix}${this.command} <text>`);
		}
		const options = {
			voice_id: "EXAVITQu4vr4xnSDxMaL",
		};

		const regex = /--(\w+)\s+([\w-]+)/g;
		let match;
		while ((match = regex.exec(_text))) {
			const [, key, value] = match;
			options[key] = value;
		}

		const text = ctx.quoted?.text || _text.replace(regex, "").trim();

		const { data, error } = await api.post("/tts/inference_text", {
			body: {
				text,
				...options,
			},
		});

		if (error) {
			return ctx.reply(error.message);
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
