import { translate } from "../../../libs/translate/index";
import Translator from "../../../libs/translate/providers";

jest.mock("../../../libs/translate/providers");

// add more timeout to avoid jest fake timer warning
jest.setTimeout(20000);

describe("translate", () => {
	it("should return the original text if target_lang is not provided", async () => {
		const result = await translate("Hello", null);
		expect(result).toBe("Hello");
	});

	it("should return an empty string if text is null and target_lang is provided", async () => {
		const result = await translate(null, "es");
		expect(result).toBe("");
	});

	it("should return the translated text when translation is successful", async () => {
		Translator.providers = {
			mockProvider: jest.fn().mockResolvedValue("Hola"),
		};
		const result = await translate("Hello", "es");
		expect(result).toBe("Hola");
	});

	it("should return the original text if all translation providers fail", async () => {
		Translator.providers = {
			mockProvider1: jest.fn().mockRejectedValue(new Error("Fail")),
			mockProvider2: jest.fn().mockRejectedValue(new Error("Fail")),
		};
		const result = await translate("Hello", "es");
		expect(result).toBe("Hello");
	});

	// it("should return the original text if translation times out", async () => {
	// 	jest.useFakeTimers();
	// 	Translator.providers = {
	// 		mockProvider: jest.fn().mockImplementation(() => {
	// 			return new Promise(() => {});
	// 		}),
	// 	};
	// 	const result = translate("Hello", "es");
	// 	jest.advanceTimersByTime(5000);
	// 	await expect(result).resolves.toThrow("Translation timeout");
	// 	jest.useRealTimers();
	// });
});
