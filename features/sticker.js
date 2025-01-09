import { createSticker } from "../libs/sticker.js";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["s", "wm", "sticker", "stiker", "watermark"],
	description: "Create sticker from image or video",
	category: "Image",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { prefix, text }) {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/sticker|webp|image|video|webm/i.test(media.mimetype)) {
			return ctx.reply(`Reply/send with *${prefix + ctx.command}*`);
		}
		const buffer = await media.download();

		const sticker = await createSticker(buffer, {
			packname: text || "ItsRose",
			author: ctx.name || "Roseanne Park",
			emojis: "🤣",
		});
		await ctx.sock.sendMessage(
			ctx.from,
			{ sticker },
			{ quoted: ctx.message }
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
