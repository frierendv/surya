import Support from "../../../libs/database/support";

describe("Support class", () => {
	let support;
	const schema = {
		id: () => Math.random().toString(36).substring(7),
		name: "defaultName",
	};

	beforeEach(() => {
		support = new Support("test", {}, schema);
	});

	test("should initialize with given name, data, and schema", () => {
		expect(support.name).toBe("test");
		expect(support.test).toEqual({});
		expect(support.schema).toBe(schema);
	});

	test("should get value by key", () => {
		support.test = { key1: "value1" };
		expect(support.get("key1")).toBe("value1");
		expect(support.get("key2")).toBeNull();
	});

	test("should set value by key according to schema", () => {
		const result = support.set("key1");
		expect(result).toHaveProperty("id");
		expect(result).toHaveProperty("name", "defaultName");
		expect(support.test.key1).toBe(result);
	});

	test("should check if key exists", () => {
		support.test = { key1: "value1" };
		expect(support.isExist("key1")).toBe(true);
		expect(support.isExist("key2")).toBe(false);
	});

	test("should delete value by key", () => {
		support.test = { key1: "value1" };
		support.delete("key1");
		expect(support.test.key1).toBeUndefined();
	});

	test("should clear all values", () => {
		support.test = { key1: "value1", key2: "value2" };
		support.clear();
		expect(support.test).toEqual({});
	});

	test("should return all values", () => {
		support.test = { key1: "value1", key2: "value2" };
		expect(support.all).toEqual({ key1: "value1", key2: "value2" });
	});
});
