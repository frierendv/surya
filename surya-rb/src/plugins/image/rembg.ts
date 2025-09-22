import { fetchClient } from "@libs/fetch";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "image-removebg",
	command: ["removebg", "rembg"],
	category: ["image"],
	description: "Remove background from images using ItsRose API.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(
				`Please provide or quote an image to enhance.\nUsage: *${usedPrefix}${command}*`
			);
		}
		const buffer = await media.download();
		const { data, error } = await fetchClient.POST("/image/rembg", {
			body: {
				init_image: Buffer.from(buffer).toString("base64"),
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
				document: {
					url: result.images[0]!,
				},
				fileName: `removebg-${
					String(ctx.pushName) + Math.floor(Date.now() % 1000)
				}.png`,
				mimetype: "image/png",
			},
			{ quoted: ctx }
		);
	},
} satisfies IPlugin;
