import { fetchClient } from "@/libs/fetch";
import { scheduler } from "@/libs/scheduler";
import type { IPlugin } from "@surya/plugin-manager";

export default {
	name: "outpainting-image",
	command: ["outpaint", "outpainting"],
	category: ["image"],
	description: "Outpaint images using ItsRose API.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(
				`Please provide or quote an image to outpaint.\nUsage: *${usedPrefix + command}* <optional extra prompt>`
			);
		}
		const buffer = await media.download();
		const { editReply } = await ctx.reply(
			"Processing your image, please wait..."
		);
		const { value, error } = await fetchClient.post("/image/outpainting", {
			init_image: Buffer.from(buffer).toString("base64"),
			expand_ratio: 0.125,
			sync: false,
		});

		if (error) {
			return editReply(
				`Failed to process image: ${error.message || "Unknown error"}`
			);
		}
		const { ok, message, data } = value!.data;
		if (!ok) {
			return editReply(message);
		}

		if (data.status === "completed") {
			await editReply("Processing completed!");
			for (const img of data.images!) {
				await sock.sendFile(ctx.from, img, { quoted: ctx });
			}
			return;
		}
		void scheduler.interval.add(
			`${ctx.sender}:outpainting`,
			2000,
			"fetch-image-status",
			{
				from: ctx.from,
				sender: ctx.sender,
				taskId: data.task_id!,
				caption: "Here's your outpainted image",
				quoted: {
					key: ctx.key,
					message: ctx.message,
				},
			},
			{ backoffMs: 1000, maxRetries: 3 }
		);
		await editReply(
			"Your outpainting task has been submitted successfully!. You will receive the image here once it's ready. Please wait patiently."
		);
	},
} satisfies IPlugin;
