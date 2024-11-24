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

	test("should initialize with given options", () => {
		expect(featureLoader._path).toBe(mockPath);
		expect(featureLoader.features).toEqual({});
		expect(featureLoader._initialized).toBe(false);
	});

	test("should initialize only once", async () => {
		await featureLoader.initialize();
		expect(featureLoader._initialized).toBe(true);
		await featureLoader.initialize();
		expect(readdirSync).toHaveBeenCalledTimes(1);
	});

	test("should load features", async () => {
		const importSpy = jest
			.spyOn(featureLoader, "import")
			.mockResolvedValue();
		await featureLoader.loadFeatures();
		expect(readdirSync).toHaveBeenCalledWith(mockPath);
		expect(importSpy).toHaveBeenCalledTimes(mockFiles.length);
	});

	test("should watch features", async () => {
		const watchCallback = jest.fn();
		watch.mockImplementation((path, callback) => {
			watchCallback.mockImplementation(callback);
		});
		await featureLoader.watchFeatures();
		expect(watch).toHaveBeenCalledWith(mockPath, expect.any(Function));
		watchCallback("change", "feature1.js");
		expect(watchCallback).toHaveBeenCalledWith("change", "feature1.js");
	});

	test("should import feature", async () => {
		const mockModule = { default: jest.fn() };
		const mockParser = jest.fn().mockResolvedValue({});
		featureLoader.parser = mockParser;
		featureLoader.folder = "mockFolder";
		featureLoader.features = {};

		jest.spyOn(featureLoader, "import").mockImplementation(async (file) => {
			const folderPath =
				process.platform === "win32"
					? `file:///${featureLoader.folder}`
					: featureLoader.folder;
			const importedModule = { default: jest.fn() };
			featureLoader.features[file] = importedModule;
			featureLoader.features[file].filePath = file;
		});

		await featureLoader.import("feature1.js");
		expect(logger.info).not.toHaveBeenCalled();
		expect(logger.error).not.toHaveBeenCalled();
		expect(featureLoader.features["feature1.js"]).toBeDefined();
	});
});
