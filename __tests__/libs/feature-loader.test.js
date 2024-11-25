import { readdirSync, watch } from "fs";
import FeatureLoader from "../../libs/feature-loader.js";
import { logger } from "../../shared/logger.js";

jest.mock("fs", () => ({
	readdirSync: jest.fn(),
	watch: jest.fn(),
}));

jest.mock("../../shared/logger.js", () => ({
	logger: {
		info: jest.fn(),
		error: jest.fn(),
	},
}));

describe("FeatureLoader", () => {
	let featureLoader;
	const mockPath = "/mock/path";
	const mockFiles = ["feature1.js", "feature2.js"];
	const mockOpts = { dir: mockPath };

	beforeEach(() => {
		readdirSync.mockReturnValue(mockFiles);
		featureLoader = new FeatureLoader(mockOpts);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	test("should validate feature with correct structure", () => {
		const validFeature = {
			command: "testCommand",
			execute: jest.fn(),
		};
		const result = featureLoader.validateFeature(validFeature);
		expect(result).toEqual(validFeature);
		expect(logger.error).not.toHaveBeenCalled();
	});

	test("should return null and log error if feature is missing command", () => {
		const invalidFeature = {
			execute: jest.fn(),
		};
		const result = featureLoader.validateFeature(invalidFeature);
		expect(result).toBeNull();
		expect(logger.error).toHaveBeenCalledWith(
			"Feature is missing a command"
		);
	});

	test("should return null and log error if feature is missing execute function", () => {
		const invalidFeature = {
			command: "testCommand",
		};
		const result = featureLoader.validateFeature(invalidFeature);
		expect(result).toBeNull();
		expect(logger.error).toHaveBeenCalledWith(
			"Feature is missing an execute function"
		);
	});

	test("should return null and log error if command is not a string or array", () => {
		const invalidFeature = {
			command: 123,
			execute: jest.fn(),
		};
		const result = featureLoader.validateFeature(invalidFeature);
		expect(result).toBeNull();
		expect(logger.error).toHaveBeenCalledWith(
			"Command must be a string or an array"
		);
	});

	test("should return null and log error if execute is not a function", () => {
		const invalidFeature = {
			command: "testCommand",
			execute: "notAFunction",
		};
		const result = featureLoader.validateFeature(invalidFeature);
		expect(result).toBeNull();
		expect(logger.error).toHaveBeenCalledWith("Execute must be a function");
	});

	test("should convert command to array if it is a string", () => {
		const feature = {
			command: "testCommand",
			execute: jest.fn(),
		};
		const result = featureLoader.validateFeature(feature);
		expect(result.command).toEqual(["testCommand"]);
		expect(logger.error).not.toHaveBeenCalled();
	});
});
