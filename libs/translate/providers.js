import { request } from "undici";

// @xct007
// This class is responsible for translating text using different translation providers.
// It has a method called translate that accepts the text to translate, the target language,
// You can add more translation providers by adding a new method to the class and adding it to the providers object.
// Just make sure the function is returning the translated text ONLY!

class Translator {
	constructor() {
		this.providers = {
			v1: this.translateV1,
			v2: this.translateV2,
			v3: this.translateV3,
			v4: this.translateV4,
			// Add more translation providers here
			// ...
		};
	}

	async translate(text, targetLang, signal, version = "v1") {
		if (this.providers[version]) {
			return this.providers[version].call(this, text, targetLang, signal);
		}
		throw new Error("Unsupported translation version");
	}

	async translateV1(text, targetLang, signal) {
		const params = new URLSearchParams({
			sl: "auto",
			tl: targetLang,
			q: text,
		});

		const response = await request(
			"https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dj=1",
			{
				method: "POST",
				body: params.toString(),
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				signal,
			}
		);

		/**
		 * fckin type
		 * @type {any}
		 */
		const json = await response.body.json();
		return json.sentences
			.filter((s) => s.trans)
			.map((s) => s.trans)
			.join("");
	}

	async translateV2(text, targetLang, signal) {
		const requestBody = {
			params: { texts: text.split("\n") },
			commonJobParams: {
				mode: "translate",
				textType: "plaintext",
				advancedMode: false,
			},
			lang: { lang_user_selected: "auto" },
			id: -1,
			jsonrpc: "2.0",
			method: "LMT_split_text",
		};

		const response = await request("https://www2.deepl.com/jsonrpc", {
			method: "POST",
			body: JSON.stringify(requestBody),
			headers: { "Content-Type": "application/json" },
			signal,
		});

		/**
		 * @type {any}
		 */
		const {
			result: { texts },
		} = await response.body.json();

		return texts
			.flatMap(({ chunks }) =>
				chunks.flatMap(({ sentences }) =>
					sentences.map(
						({ text, prefix }) => (prefix ? " " : "\n") + text
					)
				)
			)
			.join("")
			.trim();
	}

	async translateV3(text, targetLang, signal) {
		const params = new URLSearchParams({
			engine: "google",
			text,
			from: "auto",
			to: targetLang,
		});

		const response = await request(
			`https://simplytranslate.org/api/translate/?${params}`,
			{
				signal,
			}
		);

		/**
		 * @type {any}
		 */
		const json = await response.body.json();
		return json.translated_text;
	}

	async translateV4(text, targetLang, signal) {
		const body = JSON.stringify({
			sourceLanguage: null,
			targetLanguage: targetLang,
			text,
		});

		const response = await request(
			"https://api.pons.com/text-translation-web/v4/translate?locale=en",
			{
				method: "POST",
				body,
				headers: { "Content-Type": "application/json" },
				signal,
			}
		);

		/**
		 * @type {any}
		 */
		const json = await response.body.json();
		return json.text;
	}
}

export default new Translator();
