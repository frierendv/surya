import uploader from "../libs/uploader.js";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["rembg", "removebg"],
	description: "Remove background from image",
	category: "Image",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { api, prefix }) {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(`Reply/send image with *${prefix + ctx.command}*`);
		}
		const buffer = await media.download();
		const init_image = await uploader.providers.tmpfiles.upload(buffer);

		const { data, error } = await api.post("/image/rembg", {
			body: {
				init_image,
			},
		});

		if (error) {
			return ctx.reply(
				`Failed to execute the ${this.command} command\n${error.message}`
			);
		}
		const { status, result, message } = data;
		if (!status || !result?.images) {
			return ctx.reply(message);
		}

		await ctx.sock.sendMessage(
			ctx.from,
			{
				document: {
					url: result.images[0],
				},
				fileName: `rembg_${Date.now() / 1000}.png`,
				mimetype: "image/png",
			},
			{ quoted: ctx.message }
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
