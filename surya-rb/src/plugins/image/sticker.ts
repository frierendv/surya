import { createSticker } from "@/libs/sticker";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "create-sticker",
	command: ["sticker", "stiker", "s", "wm"],
	category: ["image"],
	description: "Create a sticker from an image or video.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const media = ctx.quoted?.media ?? ctx.media;
		if (
			!media ||
			!/image|video|webp/i.test(media.mimetype) ||
			(media.mimetype.includes("video") && media.size > 10_000_000)
		) {
			await ctx.reply(
				`Please provide or quote an image, webp, or a video (max 10MB) to create a sticker.\nUsage: *${usedPrefix}${command}*`
			);
			return;
		}
		const buffer = await media.download();
		const type = media.mimetype.includes("webp")
			? "webp"
			: /video/i.test(media.mimetype)
				? "video"
				: "image";
		const author = String((ctx.args[0] || ctx.pushName) ?? "").slice(0, 30);
		const packName = String(ctx.args[1] ?? "").slice(0, 30);
		const sticker = await createSticker(Buffer.from(buffer), type, {
			author,
			packName,
		});
		await sock.sendMessage(
			ctx.from,
			{ sticker, mimetype: "image/webp" },
			{ quoted: ctx }
		);
	},
} satisfies IPlugin;
