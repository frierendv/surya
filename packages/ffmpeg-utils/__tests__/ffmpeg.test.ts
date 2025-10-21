import { Readable } from "stream";
import { ffmpeg } from "../src/ffmpeg";

// Mock fluent-ffmpeg to avoid requiring a real ffmpeg binary and to capture calls
jest.mock("fluent-ffmpeg", () => {
	// mock all methods used in our wrapper
	const originalModule = jest.requireActual("fluent-ffmpeg");
	const mFfmpegCommand = {
		input: jest.fn().mockReturnThis(),
		inputFormat: jest.fn().mockReturnThis(),
		pipe: jest.fn(),
	};
	Object.assign(mFfmpegCommand, originalModule.FfmpegCommand);

	const mockFluentFfmpeg = jest.fn(() => mFfmpegCommand);
	// copy static methods
	Object.assign(mockFluentFfmpeg, originalModule);
	return mockFluentFfmpeg;
});
jest.mock("ffmpeg-static", () => "mocked-ffmpeg-path");

describe("ffmpeg wrapper", () => {
	it("inputBuffer adds input stream and optional format", async () => {
		const buffer = Buffer.from("abc");
		const cmd = ffmpeg();

		// with format
		cmd.inputBuffer(buffer, "mp3");

		// underlying methods should be invoked
		expect((cmd as any).input).toHaveBeenCalledTimes(1);
		const arg = (cmd as any).input.mock.calls[0][0];
		expect(typeof arg).toBe("object");
		expect(typeof arg.read).toBe("function"); // looks like a readable stream
		expect((cmd as any).inputFormat).toHaveBeenCalledWith("mp3");

		// without format
		(cmd as any).input.mockClear();
		(cmd as any).inputFormat.mockClear();
		cmd.inputBuffer(buffer);
		expect((cmd as any).input).toHaveBeenCalledTimes(1);
		expect((cmd as any).inputFormat).not.toHaveBeenCalled();
	});

	it("toBuffer returns data from pipe stream", async () => {
		const chunks = [Buffer.from("hello "), "world"];
		const stream = Readable.from(chunks);
		const cmd = ffmpeg();

		// make the mocked pipe() return our stream
		((cmd as any).pipe as jest.Mock).mockReturnValue(stream);

		const out = await cmd.toBuffer();
		expect(out).toBeInstanceOf(Buffer);
		expect(out.toString()).toBe("hello world");
	});

	it("returns same command object with extended methods", async () => {
		const cmd = ffmpeg();
		expect(typeof (cmd as any).toBuffer).toBe("function");
		expect(typeof (cmd as any).inputBuffer).toBe("function");
		// chainability: inputBuffer returns the same instance
		const result = cmd.inputBuffer(Buffer.from("x"));
		expect(result).toBe(cmd);
	});
});
