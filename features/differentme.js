import uploader from "../libs/uploader.js";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["differentme"],
	description: "Generate image with different style",
	category: "Image",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	/**
	 * @param {import("surya").IHandlerExtras["api"]} api
	 * @param {object} param1
	 * @param {string} param1.init_image
	 * @param {string} param1.style_id
	 * @returns
	 */
	create: async function (api, { init_image, style_id }) {
		const { data, error } = await api.post("/differentMe/create", {
			body: {
				init_image,
				// @ts-ignore
				style_id,
			},
		});
		if (error) {
			const { result, message } = error;
			let errorText = message;
			if (result?.params) {
				errorText += "\n";
				/**
				 * @type {{allowedValues:string[]}}
				 */
				const { allowedValues } = result.params;
				for (const [i, style] of allowedValues) {
					errorText += `${i + 1}. ${style}\n`;
				}
			}
			return { error: errorText };
		}
		const { status, result, message } = data;
		if (!status || !result?.task_id) {
			return { error: message };
		}
		return { task_id: result.task_id };
	},
	/**
	 * @param {import("surya").IHandlerExtras["api"]} api
	 * @param {string} task_id
	 */
	poll: async (api, task_id) => {
		let taskStatus = "";

		let pollCount = 0;
		const MAX_POLL = 30;

		while (taskStatus !== "completed" && taskStatus !== "error") {
			if (pollCount >= MAX_POLL) {
				return [false, "Task timeout"];
			}
			const { data, error } = await api.get("/differentMe/status", {
				params: {
					query: {
						task_id,
					},
				},
			});
			if (error) {
				return [false, error.message];
			}

			const { status, message, result } = data;
			if (!status || !result) {
				return [false, message];
			}
			taskStatus = result.status;
			const { images } = result;
			if (taskStatus === "completed") {
				return [true, images];
			}

			pollCount++;
			// Becareful with rate limit
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}
	},
	execute: async function (ctx, { sock, args, api, prefix }) {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(
				`Reply/send image with *${prefix + this.command}*`
			);
		}
		const buffer = await media.download();
		const init_image = await uploader.providers.tmpfiles.upload(buffer);
		const options = {
			style_id: args[0] || "3d_cartoon",
		};

		const [updateMsg] = await ctx.reply("Processing...");
		const { task_id, error } = await this.create(api, {
			init_image,
			...options,
		});
		if (error) {
			updateMsg(error);
			return;
		}

		updateMsg("Getting ready...");

		const [status, images] = await this.poll(api, task_id);
		if (!status) {
			updateMsg(images);
			return;
		}

		updateMsg(`Here your image style *${options.style_id}*`);

		for (const url of images) {
			await sock.sendMessage(
				ctx.from,
				{
					image: { url },
				},
				{ quoted: ctx.message }
			);
		}
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};
