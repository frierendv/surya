import { existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import mongoose from "mongoose";
import { Database } from "../../libs/database";
import Support from "../../libs/database/support";

jest.mock("fs");
jest.mock("mongoose");
jest.mock("../../libs/database/support");

describe("Database", () => {
	let db;
	let filePath = "./test-database.json";
	const options = {
		path: filePath,
		debug: true,
		mongo_url: "mongodb://localhost:27017/test",
		schemas: {
			user: {},
			groups: {},
			settings: {},
		},
	};

	beforeEach(() => {
		db = new Database(options);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	afterAll(() => {
		unlinkSync(filePath);
	});

	test("should initialize with default values", async () => {
		expect(db.path).toBe("./test-database.json");
		expect(db.debug).toBe(true);
		expect(db.mongo_url).toBe("mongodb://localhost:27017/test");
		expect(db.schemas).toEqual(options.schemas);
		expect(db.data).toEqual({});

		// mock the db initialization
		db.users = new Support("users", {}, options.schemas.user);
		expect(db.users).toBeInstanceOf(Support);
	});

	test("should write data to file", async () => {
		await new Promise((resolve) => setTimeout(resolve, 1000));
		writeFileSync.mockImplementation(() => {});
		await db._write();
		// wait for the mutex to release
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(writeFileSync).toHaveBeenCalledWith(
			"./test-database.json",
			JSON.stringify(db.data, null, 2)
		);
	});

	test("should initialize MongoDB", async () => {
		mongoose.connect.mockResolvedValue({});
		await db.initializeMongoDB();
		expect(mongoose.connect).toHaveBeenCalledWith(
			"mongodb://localhost:27017/test"
		);
		expect(db._model).not.toBeNull();
	});

	test("should create JSON file if not exists", async () => {
		existsSync.mockReturnValue(false);
		writeFileSync.mockImplementation(() => {});
		await db.createJsonFile();
		expect(writeFileSync).toHaveBeenCalledWith(
			"./test-database.json",
			"{}"
		);
	});

	test("should validate JSON file", () => {
		readFileSync.mockReturnValue(JSON.stringify({}));
		expect(db.isValidJsonFile()).toBe(true);
		readFileSync.mockReturnValue("invalid json");
		expect(db.isValidJsonFile()).toBe(false);
	});

	test("should initialize data from JSON file", async () => {
		existsSync.mockReturnValue(true);
		readFileSync.mockReturnValue(
			JSON.stringify({ users: {}, groups: {}, settings: {} })
		);
		await db.initialize();
		expect(db.data).toEqual({ users: {}, groups: {}, settings: {} });
		expect(Support).toHaveBeenCalledWith("users", {}, options.schemas.user);
		expect(Support).toHaveBeenCalledWith(
			"groups",
			{},
			options.schemas.groups
		);
		expect(Support).toHaveBeenCalledWith(
			"settings",
			{},
			options.schemas.settings
		);
	});

	test("should save data periodically", () => {
		jest.useFakeTimers();
		jest.spyOn(db, "_write").mockImplementation(() => {});
		db.saveDataPeriodically();
		jest.advanceTimersByTime(10_000);
		expect(db._write).toHaveBeenCalled();
		jest.useRealTimers();
	});
});
