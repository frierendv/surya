// @ts-nocheck
import { translate as TranslateApi } from "@vitalets/google-translate-api";
import { fetch } from "undici";

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
	// wtf
	if (!target_lang || !text) {
		return text ?? "";
	}
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => {
			controller.abort();
			// console.debug("[timeout] I win");
			throw new Error("Translation timeout");
		}, 5000);

		const cleanUp = (result) => {
			clearTimeout(timer);
			controller.abort();
			return result;
		};
		// race between two this sh(t)
		const v1 = translateV1(text, target_lang, controller.signal)
			.catch(() => null)
			.then(cleanUp);
		const v2 = translateV2(text, target_lang, controller.signal)
			.catch(() => null)
			.then(cleanUp);
		const result = await Promise.race([v1, v2]);
		return result ?? text;
	} catch (error) {
		if (error.name !== "AbortError") {
			console.error("Translation error:", error);
		}
		return text;
	}
}

async function translateV1(text, target_lang, signal) {
	const translation = await TranslateApi(text, {
		to: target_lang,
		fetchOptions: {
			signal,
		},
	});
	// console.debug("[v1] I win");
	return translation.text;
}

async function translateV2(text, target_lang, signal) {
	const requestBody = {
		sl: "auto",
		tl: target_lang,
		q: text,
	};
	const response = await fetch(
		"https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dj=1",
		{
			method: "POST",
			body: new URLSearchParams(requestBody).toString(),
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
			signal,
		}
	);
	const { sentences } = await response.json();
	// console.debug("[v2] I win");
	return sentences
		.filter((sentence) => "trans" in sentence)
		.map((sentence) => sentence.trans)
		.join("");
}
