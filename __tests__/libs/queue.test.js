import queue from "../../libs/feature-handler/queue";

describe("Queue", () => {
	beforeEach(() => {
		// Clear the queue before each test
		for (let key in queue.list) {
			delete queue.list[key];
		}
	});

	test("should add a feature to the queue", () => {
		queue.add("123456@s.whatsapp.net", "feature1");
		expect(queue.list["123456@s.whatsapp.net"]).toEqual(["feature1"]);
	});

	test("should check if a feature exists in the queue", () => {
		queue.add("123456@s.whatsapp.net", "feature1");
		expect(queue.exist("123456@s.whatsapp.net", "feature1")).toBe(true);
		expect(queue.exist("123456@s.whatsapp.net", "feature2")).toBe(false);
		expect(queue.exist("12@s.whatsapp.net", "feature1")).toBe(false);
	});

	test("should remove a feature from the queue", () => {
		queue.add("123456@s.whatsapp.net", "feature1");
		queue.add("123456@s.whatsapp.net", "feature2");
		queue.remove("123456@s.whatsapp.net", "feature1");
		expect(queue.list["123456@s.whatsapp.net"]).toEqual(["feature2"]);
	});

	test("should handle removing a non-existent feature gracefully", () => {
		queue.add("123456@s.whatsapp.net", "feature1");
		queue.remove("123456@s.whatsapp.net", "feature2");
		expect(queue.list["123456@s.whatsapp.net"]).toEqual(["feature1"]);
	});

	test("should handle removing a feature from a non-existent user gracefully", () => {
		queue.remove("123456@s.whatsapp.net", "feature1");
		expect(queue.list["123456@s.whatsapp.net"]).toBeUndefined();
	});

	test("should return the correct list of features", () => {
		queue.add("123456@s.whatsapp.net", "feature1");
		queue.add("123456@s.whatsapp.net", "feature2");
		queue.add("12@s.whatsapp.net", "feature3");
		expect(queue.list).toEqual({
			"123456@s.whatsapp.net": ["feature1", "feature2"],
			"12@s.whatsapp.net": ["feature3"],
		});
	});
});
