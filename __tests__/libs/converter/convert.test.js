import { readFileSync } from "fs";
import { convert } from "../../../libs/converter/convert";
import * as formats from "../../../libs/converter/formats";

jest.mock("../../../libs/converter/convert");

describe("convert", () => {
	const fixturePath = "./__tests__/fixtures/image.png";
	const mockInputBuffer = readFileSync(fixturePath);

	afterEach(() => {
		jest.resetAllMocks();
	});

	it("throws an error when input is not a buffer", async () => {
		const errorMessage = "Invalid input buffer";
		convert.mockRejectedValue(new Error(errorMessage));

		await expect(convert(null)).rejects.toThrow(errorMessage);
		expect(convert).toHaveBeenCalledWith(null);
	});

	it("converts image to webp format successfully", async () => {
		const mockOutputBuffer = Buffer.from("converted webp buffer");
		const targetFormat = "webp";
		const formatType = formats.sticker.image;

		convert.mockResolvedValueOnce(mockOutputBuffer);
		const result = await convert(mockInputBuffer, targetFormat, formatType);

		expect(convert).toHaveBeenCalledWith(
			mockInputBuffer,
			targetFormat,
			formatType
		);
		expect(result).toBe(mockOutputBuffer);
	});
});
