import Ytdl from "@distube/ytdl-core";
import youtube from "../../libs/youtube.js";

// Mock dependencies
jest.mock("@distube/ytdl-core");
jest.mock("../../libs/youtube/stream-util.js");

describe("YouTube", () => {
	it("should retrieve video information", async () => {
		Ytdl.getInfo.mockResolvedValue({
			videoDetails: {
				title: "Test Title",
				description: "Test Description",
				category: "Test Category",
				publishDate: "2021-01-01",
				uploadDate: "2021-01-02",
				author: "Test Author",
			},
			formats: [
				{ quality: "medium", hasVideo: true, hasAudio: true },
				{ audioBitrate: 128, hasAudio: true },
			],
		});

		const info = await youtube.getInfo("http://testurl.com");

		expect(info.title).toBe("Test Title");
		expect(info.audio.audioBitrate).toBe(128);
	});

	it("should throw an error if no suitable format is found", async () => {
		Ytdl.getInfo.mockResolvedValue({
			videoDetails: {
				/* TODO */
			},
			formats: [],
		});

		await expect(youtube.getInfo("http://testurl.com")).rejects.toThrow(
			"No suitable format found"
		);
	});
});
