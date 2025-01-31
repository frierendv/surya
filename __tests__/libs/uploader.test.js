import { fileTypeFromBuffer } from "file-type";
import { readFileSync } from "fs";
import Uploader from "../../libs/uploader";

jest.mock("file-type", () => ({
	fileTypeFromBuffer: jest.fn(),
}));
fileTypeFromBuffer.mockResolvedValue({ mime: "image/png", ext: "png" });

// increase timeout because uploading to some providers may take a while
jest.setTimeout(30000);

describe("Uploader", () => {
	let imageBuffer;

	beforeAll(() => {
		imageBuffer = readFileSync("./__tests__/fixtures/image.png");
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("should be able to upload an image", async () => {
		const url = await Uploader.upload(imageBuffer);

		expect(url).toMatch(/https?:\/\//);
	});
});
