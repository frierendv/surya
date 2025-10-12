import { fetchClient } from "@libs/fetch";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "outpainting-image",
	command: ["outpaint", "outpainting"],
	category: ["image"],
	description: "Outpaint images using ItsRose API.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(
				`Please provide or quote an image to outpaint.\nUsage: *${usedPrefix + command}* <optional extra prompt>`
			);
		}
		const extraPrompt = ctx.text?.trim() || undefined;
		const buffer = await media.download();
		const { data, error } = await fetchClient.POST("/image/outpainting", {
			body: {
				init_image: Buffer.from(buffer).toString("base64"),
				extra_prompt: extraPrompt,
			},
		});

		if (error) {
			return ctx.reply(
				`Failed to process image: ${error.message || "Unknown error"}`
			);
		}
		const { status, result, message } = data;
		if (!status || !result?.images) {
			return ctx.reply(message);
		}
		await sock.sendMessage(
			ctx.from,
			{
				image: { url: result.images[0]! },
				caption: "Here is your outpainted image!",
			},
			{ quoted: ctx }
		);
	},
} satisfies IPlugin;
