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

	it("converts image to jpg format successfully", async () => {
		const mockOutputBuffer = Buffer.from("converted jpg buffer");
		const targetFormat = "jpg";
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

	it("throws an error when format is invalid", async () => {
		const errorMessage = "Unsupported format";
		convert.mockRejectedValue(new Error(errorMessage));

		const invalidFormat = "invalid_format";
		const formatType = formats.sticker.image;

		await expect(
			convert(mockInputBuffer, invalidFormat, formatType)
		).rejects.toThrow(errorMessage);
		expect(convert).toHaveBeenCalledWith(
			mockInputBuffer,
			invalidFormat,
			formatType
		);
	});

	it("handles Ffmpeg error correctly", async () => {
		const errorMessage = "Ffmpeg processing error";
		convert.mockRejectedValue(new Error(errorMessage));

		const targetFormat = "png";
		const formatType = formats.sticker.image;

		await expect(
			convert(mockInputBuffer, targetFormat, formatType)
		).rejects.toThrow(errorMessage);
		expect(convert).toHaveBeenCalledWith(
			mockInputBuffer,
			targetFormat,
			formatType
		);
	});

	it("throws an error when temporary file is missing after conversion", async () => {
		const errorMessage = "Temporary file not found";
		convert.mockRejectedValue(new Error(errorMessage));

		const targetFormat = "gif";
		const formatType = formats.sticker.image;

		await expect(
			convert(mockInputBuffer, targetFormat, formatType)
		).rejects.toThrow(errorMessage);
		expect(convert).toHaveBeenCalledWith(
			mockInputBuffer,
			targetFormat,
			formatType
		);
	});

	it("converts image with additional arguments successfully", async () => {
		const mockOutputBuffer = Buffer.from("converted with args buffer");
		const targetFormat = "bmp";
		const additionalArgs = ["-resize", "100x100"];

		convert.mockResolvedValueOnce(mockOutputBuffer);
		const result = await convert(
			mockInputBuffer,
			targetFormat,
			additionalArgs
		);

		expect(convert).toHaveBeenCalledWith(
			mockInputBuffer,
			targetFormat,
			additionalArgs
		);
		expect(result).toBe(mockOutputBuffer);
	});
});
