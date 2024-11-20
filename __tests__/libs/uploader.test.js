import { fileTypeFromBuffer } from "file-type";
import { readFileSync } from "fs";
import Uploader from "../../libs/uploader";

jest.mock("file-type", () => ({
	fileTypeFromBuffer: jest.fn(),
}));
fileTypeFromBuffer.mockResolvedValue({ mime: "image/png", ext: "png" });

describe("Uploader", () => {
	let imageBuffer;

	beforeAll(() => {
		imageBuffer = readFileSync("./__tests__/fixtures/image.png");
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("should upload to quax", async () => {
		const url = await Uploader.upload(imageBuffer, "quax");
		expect(url).toContain("qu.ax");
	});
	test("should upload to freeimage", async () => {
		const url = await Uploader.upload(imageBuffer, "freeimage");
		expect(url).toBeDefined();
	});
	test("should upload to tmpfiles", async () => {
		const url = await Uploader.upload(imageBuffer, "tmpfiles");
		expect(url).toBeDefined();
	});
	test("should upload to pasteboard", async () => {
		const url = await Uploader.upload(imageBuffer, "pasteboard");
		expect(url).toBeDefined();
	});
});
