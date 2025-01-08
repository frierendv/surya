import { fileTypeFromBuffer } from "file-type";
import { readFileSync } from "fs";
import webPMux from "node-webpmux";
import { convert } from "../../libs/converter/convert";
import { createSticker } from "../../libs/sticker";

jest.mock("file-type", () => ({
	fileTypeFromBuffer: jest.fn(),
}));
jest.mock("../../libs/converter/convert");
jest.mock("node-webpmux");

describe("createSticker", () => {
	let mockInputBuffer;

	beforeEach(() => {
		mockInputBuffer = readFileSync("./__tests__/fixtures/image.png");
	});

	afterEach(() => {
		jest.resetAllMocks();
	});

	it("should throw an error if input is not a buffer", async () => {
		await expect(createSticker("not a buffer")).rejects.toThrow(
			"Invalid input: Buffer required"
		);
	});

	it("should throw an error if file type is unsupported", async () => {
		fileTypeFromBuffer.mockResolvedValueOnce(null);
		await expect(createSticker(mockInputBuffer)).rejects.toThrow(
			"Unsupported file type"
		);
	});

	it("should throw an error if format type is unsupported", async () => {
		fileTypeFromBuffer.mockResolvedValueOnce({ mime: "unknown/type" });
		await expect(createSticker(mockInputBuffer)).rejects.toThrow(
			"Unsupported format type: unknown"
		);
	});

	it("should create a sticker successfully for supported image format", async () => {
		fileTypeFromBuffer.mockResolvedValueOnce({ mime: "image/png" });
		convert.mockResolvedValueOnce(Buffer.from("converted webp buffer"));
		const mockWebpImage = {
			load: jest.fn(),
			save: jest.fn().mockResolvedValue(Buffer.from("sticker buffer")),
		};
		webPMux.Image.mockImplementation(() => mockWebpImage);

		const result = await createSticker(mockInputBuffer);

		expect(fileTypeFromBuffer).toHaveBeenCalledWith(mockInputBuffer);
		expect(convert).toHaveBeenCalledWith(
			mockInputBuffer,
			"webp",
			expect.any(Array)
		);
		expect(mockWebpImage.load).toHaveBeenCalledWith(
			Buffer.from("converted webp buffer")
		);
		expect(result).toEqual(Buffer.from("sticker buffer"));
	});

	it("should create a sticker successfully for webp format", async () => {
		fileTypeFromBuffer.mockResolvedValueOnce({ mime: "image/webp" });
		const mockWebpImage = {
			load: jest.fn(),
			save: jest.fn().mockResolvedValue(Buffer.from("sticker buffer")),
		};
		webPMux.Image.mockImplementation(() => mockWebpImage);

		const result = await createSticker(mockInputBuffer);

		expect(fileTypeFromBuffer).toHaveBeenCalledWith(mockInputBuffer);
		expect(convert).not.toHaveBeenCalled();
		expect(mockWebpImage.load).toHaveBeenCalledWith(mockInputBuffer);
		expect(result).toEqual(Buffer.from("sticker buffer"));
	});
});
