import { Readable } from "stream";

// Mock fluent-ffmpeg to avoid requiring a real ffmpeg binary and to capture calls
jest.mock("fluent-ffmpeg", () => {
	const input = jest.fn().mockReturnThis();
	const inputFormat = jest.fn().mockReturnThis();
	const pipe = jest.fn();
	const ctor = jest.fn(() => ({ input, inputFormat, pipe }));
	return { __esModule: true, default: ctor };
});

describe("ffmpeg wrapper", () => {
	it("inputBuffer adds input stream and optional format", async () => {
		const { ffmpeg } = await import("../src/ffmpeg");
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
		const { ffmpeg } = await import("../src/ffmpeg");
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
		const { ffmpeg } = await import("../src/ffmpeg");
		const cmd = ffmpeg();
		expect(typeof (cmd as any).toBuffer).toBe("function");
		expect(typeof (cmd as any).inputBuffer).toBe("function");
		// chainability: inputBuffer returns the same instance
		const result = cmd.inputBuffer(Buffer.from("x"));
		expect(result).toBe(cmd);
	});
});
