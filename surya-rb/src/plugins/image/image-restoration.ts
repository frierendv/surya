import { fetchClient } from "@/libs/fetch";
import { scheduler } from "@/libs/scheduler";
import type { IPlugin } from "@surya/plugin-manager";

// a brief description of each restoration mode
const restorationMode = {
	hd: "HD",
	uhd: "UHD",
	ng_uhd: "NG_UHD",
} as const;
// values of restorationMode
type RestorationMode = (typeof restorationMode)[keyof typeof restorationMode];

const description = `Enhance your images using advanced restoration techniques. Choose from the following modes:
- *hd*: High Definition Restoration
- *uhd*: Ultra High Definition Restoration
- *ng_uhd*: Next Generation Ultra High Definition Restoration

By default, the 'hd' mode is used.

Example: *.ng_hd* (quote or attach an image)`;

export default {
	name: "image-restoration",
	command: ["image-restoration", "img-restore", "hd", "uhd", "ng_uhd"],
	category: ["image"],
	description,
	execute: async (ctx, { command, sock }) => {
		let restoration_mode: RestorationMode = "HD";
		if (restorationMode[command as keyof typeof restorationMode]) {
			restoration_mode = command.toUpperCase() as RestorationMode;
		}
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply("Please attach or quote an image to enhance.");
		}
		const buffer = await media.download();
		const { editReply } = await ctx.reply(
			`Enhancing your image using *${restoration_mode}* mode, please wait...`
		);
		const { value, error } = await fetchClient.post("/image/restoration", {
			init_image: Buffer.from(buffer).toString("base64"),
			restoration_mode,
		});

		if (error || !value) {
			return editReply(
				`Failed to process image: ${error?.message || "Unknown error"}`
			);
		}
		const { status, result, message } = value.data;
		if (!status || !result) {
			return editReply(
				`Failed to process image: ${message || "Unknown error"}`
			);
		}

		if (result.status === "completed") {
			await editReply("Processing completed!");
			const { images } = result!;
			for (const img of images!) {
				await sock.sendFile(ctx.from, img, { quoted: ctx });
			}
			return;
		}
		void scheduler.interval.add(
			`${ctx.sender}:image-restoration`,
			2000,
			"fetch-image-status",
			{
				from: ctx.from,
				sender: ctx.sender,
				taskId: result.task_id,
				caption: `Here's your restored image using *${restoration_mode}* mode.`,
				quoted: {
					key: ctx.key,
					message: ctx.message,
				},
			}
		);
		await editReply(
			"Your image is being processed. You will receive it once it's done."
		);
	},
} satisfies IPlugin;
