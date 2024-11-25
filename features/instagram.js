import { fileTypeFromBuffer } from "file-type";
import { fetch } from "undici";

/**
 * @type {import("surya").Feature}
 */
export default {
	command: ["instagram", "ig"],
	description: "Download Media from Instagram.",
	category: "Downloader",
	owner: false,
	admin: false,
	hidden: false,
	limit: false,
	group: false,
	private: false,

	execute: async function (ctx, { sock, api, args }) {
		const url = args[0];
		if (!url) {
			return ctx.reply("Please provide a Instagram link");
		}

		const { error, data } = await api.get("/instagram/download", {
			params: {
				query: {
					url,
				},
			},
		});
		if (error) {
			return ctx.reply(error.message || "Failed to fetch the data");
		}
		const { status, message, result } = data;
		if (!status || !result?.contents) {
			return ctx.reply(message);
		}

		for (const { url } of result.contents) {
			// @ts-ignore
			const { type, data } = await getType(url);
			if (!type) {
				continue;
			}
			await sock.sendMessage(
				ctx.from,
				// @ts-ignore
				{
					// @ts-ignore
					[type]: data,
				},
				{ quoted: ctx.message }
			);
		}
	},
	failed: "Failed to execute the %cmd command\n%error",
	wait: null,
	done: null,
};

/**
 * Get the media type from the url
 * @param {string} url
 * @returns {Promise<{type: "video" | "audio" | "image"; data: Buffer;}>}
 */
const getType = async (url) => {
	const response = await fetch(url);
	const data = await response.arrayBuffer();

	const fileType = await fileTypeFromBuffer(data);
	if (!fileType) {
		throw new Error("Unable to determine file type");
	}
	const { mime } = fileType;
	return {
		type: mime.includes("video")
			? "video"
			: mime.includes("audio")
				? "audio"
				: "image",
		data: Buffer.from(data),
	};
};
