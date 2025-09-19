import { debounce } from "../src/debounce";

describe("debounce", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	test("only invokes the last call within the window", () => {
		const fn = jest.fn();
		const d = debounce(fn, 50);

		d(1);
		jest.advanceTimersByTime(25);
		d(2);
		jest.runAllTimers();

		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenCalledWith(2);
	});

	test("invokes multiple calls spaced beyond the window", () => {
		const fn = jest.fn();
		const d = debounce(fn, 20);

		d("a");
		jest.advanceTimersByTime(25);
		d("b");
		jest.runAllTimers();

		expect(fn).toHaveBeenCalledTimes(2);
		expect(fn.mock.calls[0][0]).toBe("a");
		expect(fn.mock.calls[1][0]).toBe("b");
	});
});
