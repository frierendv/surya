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

	execute: async function (m, { sock, api, args }) {
		const url = args[0];
		if (!url) {
			return m.reply("Please provide a Instagram link");
		}
		const { error, data } = await api.get("/instagram/get_content", {
			params: {
				query: {
					url,
				},
			},
		});
		if (error) {
			return m.reply(error.message || "Failed to fetch the data");
		}
		const { status, message, result } = data;
		if (!status || !result?.contents) {
			return m.reply(message);
		}
		for (const url of result.contents) {
			const { type, data } = await getType(url);
			if (!type) {
				continue;
			}
			await sock.sendMessage(
				m.from,
				// @ts-ignore
				{
					// @ts-ignore
					[type]: data,
				},
				{ quoted: m.message }
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