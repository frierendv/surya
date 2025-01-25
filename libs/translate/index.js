import Translator from "./providers.js";

export async function translate(text, target_lang) {
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
		// race between all translation functions
		const result = await wrapTranslate(
			text,
			target_lang,
			controller.signal
		);
		return cleanUp(result || text);
	} catch (error) {
		if (error.name !== "AbortError") {
			console.error("Translation error:", error);
		}
		return text;
	}
}

async function wrapTranslate(text, target_lang, signal) {
	const translateFunctions = Object.values(Translator.providers);
	const translatePromises = translateFunctions.map((fn) =>
		// Make sure to catch any error
		fn(text, target_lang, signal).catch(() => null)
	);
	const result = await Promise.race(translatePromises);
	return result;
}
