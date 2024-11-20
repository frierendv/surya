import cron from "node-cron";
import Cronjob from "../../../libs/database/cronjob";

jest.mock("node-cron");

describe("Cronjob", () => {
	let cronjob;
	const name = "testJob";
	const data = { key: "value" };
	const schema = {};

	beforeEach(() => {
		cronjob = new Cronjob(name, data, schema);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	test("should initialize with correct properties", () => {
		expect(cronjob.name).toBe(name);
		expect(cronjob[name]).toEqual(data);
		expect(cronjob.schema).toBe(schema);
	});

	test("should validate a correct cron expression", () => {
		cron.validate.mockReturnValue(true);
		expect(cronjob.validate("0 * * * *")).toBe(true);
		expect(cron.validate).toHaveBeenCalledWith("0 * * * *");
	});

	test("should invalidate an incorrect cron expression", () => {
		cron.validate.mockReturnValue(false);
		expect(cronjob.validate("invalid expression")).toBe(false);
		expect(cron.validate).toHaveBeenCalledWith("invalid expression");
	});

	test("should schedule a job with a valid cron expression", () => {
		const expression = "0 * * * *";
		const mockFunction = jest.fn();
		const options = { scheduled: true };

		cron.validate.mockReturnValue(true);
		cron.schedule.mockImplementation((exp, func, opts) => func());

		cronjob.schedule(expression, mockFunction, options);

		expect(cron.validate).toHaveBeenCalledWith(expression);
		expect(cron.schedule).toHaveBeenCalledWith(
			expression,
			expect.any(Function),
			options
		);
		expect(mockFunction).toHaveBeenCalledWith(data);
	});

	test("should throw an error for an invalid cron expression", () => {
		const expression = "invalid expression";
		const mockFunction = jest.fn();
		const options = { scheduled: true };

		cron.validate.mockReturnValue(false);

		expect(() =>
			cronjob.schedule(expression, mockFunction, options)
		).toThrow("Invalid cron expression");
		expect(cron.validate).toHaveBeenCalledWith(expression);
		expect(cron.schedule).not.toHaveBeenCalled();
	});

	test("should return tasks", () => {
		const tasks = { task1: {}, task2: {} };
		cron.getTasks.mockReturnValue(tasks);

		expect(cronjob.tasks).toBe(tasks);
		expect(cron.getTasks).toHaveBeenCalled();
	});
});
