/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["hd", "upscale"],
	description: "Next Generation Ultra High Definition Image Restoration",
	category: "Image",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { api, prefix, text, command }) {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(`Reply/send image with *${prefix + command}*`);
		}
		const options = {
			restoration_mode: "NG_UHD",
		};

		const regex = /--(\w+)\s+([\w-]+)/g;
		let match;
		while ((match = regex.exec(text))) {
			const [, key, value] = match;
			options[key] = value;
		}

		const buffer = await media.download();

		const { data, error } = await api.post("/image/restoration", {
			body: {
				init_image: Buffer.from(buffer).toString("base64"),
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
