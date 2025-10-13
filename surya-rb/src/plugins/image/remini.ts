import { fetchClient } from "@libs/fetch";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "image-remini",
	command: ["remini"],
	category: ["image"],
	description:
		"Enhance and upscale images using the ItsRose API Remini AI service.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(
				`Please provide or quote an image to enhance.\nUsage: *${usedPrefix}${command}*`
			);
		}
		const buffer = await media.download();
		const { data, error } = await fetchClient.POST("/image/remini", {
			body: {
				init_image: Buffer.from(buffer).toString("base64"),
				pipeline: {
					bokeh: "background_blur_low",
					color_enhance: "prism-blend",
					background_enhance: "shiba-strong-tensorrt",
					face_lifting: "pinko_bigger_dataset-style",
					face_enhance: "remini",
				},
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
				caption: "Here's your enhanced image using Remini AI.",
			},
			{ quoted: ctx }
		);
	},
} satisfies IPlugin;
