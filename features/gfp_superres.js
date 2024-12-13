import uploader from "../libs/uploader.js";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["gfps", "gfp_superres "],
	description:
		"Enhance image resolution and clarity with advanced super-resolution processing.​",
	category: "Image",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { api, prefix, text }) {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(
				`Reply/send image with *${prefix + this.command}*`
			);
		}
		const options = {
			outscale: 2,
		};

		const regex = /--(\w+)\s+([\w-]+)/g;
		let match;
		while ((match = regex.exec(text))) {
			const [, key, value] = match;
			options[key] = value;
		}

		const buffer = await media.download();
		const init_image = await uploader.providers.tmpfiles.upload(buffer);

		const { data, error } = await api.post("/image/gfp_superres", {
			body: {
				init_image,
				...options,
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
				image: {
					url: result.images[0],
				},
			},
			{ quoted: ctx.message }
		);
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
