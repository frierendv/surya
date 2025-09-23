import { fetchClient } from "@libs/fetch";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "text-to-speech",
	command: ["tts"],
	category: ["audio"],
	description: "Text to speech using ItsRose API.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		if (!ctx.text) {
			return ctx.reply(
				`Please provide text to convert to speech.\nUsage: *${usedPrefix}${command} <text>*`
			);
		}
		const options: Record<string, string> = {};
		const regex = /--(\w+)\s+([\w-]+)/g;
		let match;
		while ((match = regex.exec(ctx.text))) {
			const [, key, value] = match;
			if (!key) {
				continue;
			}
			options[key] = value ?? "";
		}
		const text = ctx.quoted?.text || ctx.text.replace(regex, "").trim();
		const { data, error } = await fetchClient.POST(
			"/elevenlabs/inference_text",
			{
				body: {
					voice_id: "EXAVITQu4vr4xnSDxMaL",
					server_id: "rose",
					text,
					...options,
				},
			}
		);
		if (error) {
			await ctx.reply(error.message);
			return;
		}
		const { status, result, message } = data;
		if (!status || !result?.audio_url) {
			await ctx.reply(message);
			return;
		}
		await sock.sendFile(ctx.from, result.audio_url, {
			ptt: true,
			quoted: ctx,
		});
	},
} satisfies IPlugin;
