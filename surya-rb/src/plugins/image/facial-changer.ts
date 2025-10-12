import { fetchClient } from "@libs/fetch";
import type { IPlugin } from "@surya/plugin-manager";

type FaceType = "laugh" | "smile" | "pose_ps" | "cool" | "cspv" | "dimples";
const faceTypes: readonly FaceType[] = [
	"laugh",
	"smile",
	"pose_ps",
	"cool",
	"cspv",
	"dimples",
];

export default {
	name: "facial-expression-changer",
	command: ["facialchanger", "facechange", "faceapp"],
	category: ["image"],
	description: "Change facial expression in images using ItsRose API.",
	execute: async (ctx, { command, usedPrefix, sock }) => {
		const media = ctx.quoted?.media ?? ctx.media;
		if (!media || !/image/i.test(media.mimetype)) {
			return ctx.reply(
				`Please provide or quote an image to change facial expression.\nUsage: *${usedPrefix + command}* <expression type>\nAvailable types: ${faceTypes
					.map((type) => `*${type}*`)
					.join(", ")}`
			);
		}
		const expression = (ctx.args[0] ?? "smile").toLowerCase() as FaceType;
		if (!faceTypes.includes(expression)) {
			return ctx.reply(
				`Invalid expression type. Available types are: ${faceTypes
					.map((type) => `*${type}*`)
					.join(", ")}`
			);
		}
		const buffer = await media.download();
		const { data, error } = await fetchClient.POST(
			"/image/facial_expression",
			{
				body: {
					init_image: Buffer.from(buffer).toString("base64"),
					expression,
				},
			}
		);

		if (error) {
			return ctx.reply(
				`Failed to process image: ${error.message || "Unknown error"}`
			);
		}
		const { status, result, message } = data;
		if (!status || !result?.images) {
			return ctx.reply(message);
		}
		await sock.sendMessage(
			ctx.from,
			{
				image: { url: result.images[0]! },
				caption: `Here is your image with a *${expression}* expression!`,
			},
			{ quoted: ctx }
		);
	},
} satisfies IPlugin;
