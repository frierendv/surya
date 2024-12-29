// Idk bruvh, its getting hard to read the code. I'm sorry for that.
import uploader from "../libs/uploader.js";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["unblur", "remini"],
	description: "Enhance image",
	category: "Image",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { api, prefix, command }) {
		const media = await this.getValidImage(ctx, prefix, command);
		if (!media) {
			return;
		}

		const [updateMsg, deleteMsg] = await ctx.reply("Processing image...");

		const init_image = await this.prepareImage(media);

		const processedImages = await this.processImage(
			api,
			init_image,
			updateMsg
		);

		if (processedImages) {
			for (const url of processedImages) {
				await ctx.sock.sendMessage(
					ctx.from,
					{
						image: { url },
						caption: "Here is the result",
					},
					{ quoted: ctx.message }
				);
			}

			deleteMsg();
		}
	},

	getValidImage: async function (ctx, prefix, command) {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media?.mimetype)) {
			ctx.reply(`Reply/send image with *${prefix + command}*`);
			return null;
		}
		return media;
	},

	prepareImage: async function (media) {
		const buffer = await media.download();
		return await uploader.providers.tmpfiles.upload(buffer);
	},

	processImage: async function (api, init_image, updateMsg) {
		updateMsg("Processing image... (2/2)");

		const { data, error } = await this.unblurImage(api, init_image);
		if (error) {
			updateMsg(error.message);
			return null;
		}
		const { status, result, message } = data;
		if (!status || !result?.images) {
			updateMsg(message);
			return null;
		}
		return result.images;
	},

	unblurImage: async function (api, init_image) {
		return await api.post("/image/unblur", {
			body: {
				init_image,
				pipeline: {
					bokeh: "background_blur_low",
					color_enhance: "prism-blend",
					background_enhance: "shiba-strong-tensorrt",
					face_lifting: "pinko_bigger_dataset-style",
					face_enhance: "recommender_entire_dataset",
				},
			},
		});
	},

	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
