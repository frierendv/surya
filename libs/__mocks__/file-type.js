"use strict";

module.exports = {
	fileType: jest.fn(() => {
		return { mime: "image/png", ext: "png" };
	}),
};
