import { fetch } from "undici";
import { Y2Mate } from "../../libs/y2mate.js";

jest.mock("undici", () => ({
	fetch: jest.fn(),
}));

describe("Y2Mate", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("should initialize with default values", () => {
		const y2mate = new Y2Mate();
		expect(y2mate.baseURL).toBe("https://www.y2mate.com");
		expect(y2mate.headers).toHaveProperty("accept", "*/*");
		expect(y2mate.mapTypes).toEqual([
			"mp3",
			"360p",
			"480p",
			"720p",
			"1080p",
		]);
	});

	test("should fetch video info", async () => {
		const y2mate = new Y2Mate();
		const mockResponse = {
			json: jest.fn().mockResolvedValue({
				title: "Test Video",
				a: "Test Author",
				links: {
					mp3: {
						"128kbps": { size: "3.5MB", f: "mp3", k: "key1" },
					},
					mp4: {
						"360p": { size: "20MB", f: "mp4", k: "key2" },
					},
				},
				vid: "test_vid",
				c_status: "OK",
			}),
		};
		fetch.mockResolvedValue(mockResponse);

		const info = await y2mate.info("https://www.youtube.com/watch?v=test");
		expect(info).toEqual({
			title: "Test Video",
			author: "Test Author",
			urls: {
				mp3: {
					"128kbps": {
						size: "3.5MB",
						download: expect.any(Function),
					},
				},
				mp4: {
					"360p": {
						size: "20MB",
						download: expect.any(Function),
					},
				},
			},
		});
	});

	test("should handle failed video info fetch", async () => {
		const y2mate = new Y2Mate();
		const mockResponse = {
			json: jest.fn().mockResolvedValue({
				c_status: "FAILED",
			}),
		};
		fetch.mockResolvedValue(mockResponse);

		const info = await y2mate.info("https://www.youtube.com/watch?v=test");
		expect(info).toEqual({
			error: true,
			message: "Failed to download the video",
		});
	});

	test("should convert video", async () => {
		const y2mate = new Y2Mate();
		const mockResponse = {
			json: jest.fn().mockResolvedValue({
				status: "ok",
				dlink: "https://download.link",
			}),
		};
		fetch.mockResolvedValue(mockResponse);

		const result = await y2mate._doConvert("test_vid", "key1");
		expect(result).toEqual({
			status: "ok",
			dlink: "https://download.link",
		});
	});

	test("should fetch buffer from URL", async () => {
		const y2mate = new Y2Mate();
		const mockResponse = {
			buffer: jest.fn().mockResolvedValue(Buffer.from("test buffer")),
		};
		fetch.mockResolvedValue(mockResponse);

		const buffer = await y2mate._toBuffer("https://download.link");
		expect(buffer).toEqual(Buffer.from("test buffer"));
	});
});
