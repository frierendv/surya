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

	execute: async function (m, { sock, api, prefix, command }) {
		const media = m.quoted?.media ?? m.media;
		if (!media || !/image/i.test(media?.mimetype)) {
			m.reply(`Reply/send image with *${prefix + command}*`);
			return;
		}
		const buffer = await media.download();
		const init_image = await uploader.providers.tmpfiles.upload(buffer);

		const { data, error } = await api.post("/image/unblur", {
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
		if (error) {
			m.reply(error.message);
			return;
		}
		const { status, result, message } = data;
		if (!status || !result?.images) {
			m.reply(message);
			return;
		}
		for (const url of result.images) {
			await sock.sendMessage(
				m.from,
				{ image: { url } },
				{ quoted: m.message }
			);
		}
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
