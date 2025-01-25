// @ts-nocheck
import { translate as TranslateApi } from "@vitalets/google-translate-api";

/**
 *
 * @param {import("@frierendv/frieren").Baileys.IContextMessage} ctx
 * @returns {import("@frierendv/frieren").Baileys.IContextMessage}
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

async function translate(text, target_lang) {
	if (!target_lang) {
		return text;
	}
	// const timeout = new Promise((_, reject) =>
	// 	setTimeout(() => reject(new Error("Translation timeout")), 3000)
	// );
	const translation = TranslateApi(text, {
		to: target_lang,
		fetchOptions: {
			timeout: 10000,
		},
	}).catch(() => ({
		text,
	}));
	const { text: translatedText } = await Promise.race([
		translation,
		// timeout,
	]).catch(() => ({ text }));
	return translatedText;
}
