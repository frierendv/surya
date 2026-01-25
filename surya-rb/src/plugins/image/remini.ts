import { fetchClient } from "@/libs/fetch";
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

		const { value, error } = await fetchClient.post("/image/remini", {
			init_image: Buffer.from(buffer).toString("base64"),
			pipeline: {
				bokeh: "background_blur_low",
				color_enhance: "prism-blend",
				background_enhance: "shiba-strong-tensorrt",
				face_lifting: "pinko_bigger_dataset-style",
				face_enhance: "remini",
			},
		});

		if (error) {
			return ctx.reply(
				`Failed to process image: ${error.message || "Unknown error"}`
			);
		}
		const { ok, message, data } = value!.data;
		if (!ok) {
			return ctx.reply(message);
		}

		if (!("images" in data) || !data?.images?.length) {
			return ctx.reply("Failed to enhanced the image.");
		}

		await sock.sendMessage(
			ctx.from,
			{
				image: { url: data.images[0] as string },
				caption: "Here's your enhanced image using Remini AI.",
			},
			{ quoted: ctx }
		);
	},
} satisfies IPlugin;
