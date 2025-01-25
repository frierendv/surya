// @ts-nocheck
import { translate } from "./translate/index.js";

/**
 *
 * @param {import("@frierendv/frieren").Baileys.IContextMessage} ctx
 * @returns {import("@frierendv/frieren").Baileys.IContextMessage | Record<string, any>}
 */
export function translator(ctx) {
	const { country, reply, sock } = ctx;
	const replyTranslate = async (text, opts) => {
		const translatedText = await translate(text, country);
		return reply(translatedText, opts);
	};
	const sendMessageTranslate = async (jid, content, opts) => {
		if (content?.text) {
			content.text = await translate(content.text, country);
		} else if (content?.caption) {
			content.caption = await translate(content.caption, country);
		}
		return sock.sendMessage(jid, content, opts);
	};
	const sendFileTranslate = async (jid, file, filename, opts) => {
		if (opts?.caption) {
			opts.caption = await translate(opts.caption, country);
		}
		return sock.sendFile(jid, file, filename, opts);
	};
	return {
		reply: replyTranslate,
		sock: {
			sendMessage: sendMessageTranslate,
			sendFile: sendFileTranslate,
		},
	};
}
