import { fetchClient } from "@/libs/fetch";
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
		const { value, error } = await fetchClient.post("/image/rembg", {
			init_image: Buffer.from(buffer).toString("base64"),
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
			return ctx.reply("Failed to remove the image background.");
		}

		await sock.sendMessage(
			ctx.from,
			{
				document: {
					url: data.images[0] as string,
				},
				fileName: `removebg-${
					String(ctx.pushName) + "-" + Math.floor(Date.now() % 1000)
				}.png`,
				mimetype: "image/png",
			},
			{ quoted: ctx }
		);
	},
} satisfies IPlugin;
