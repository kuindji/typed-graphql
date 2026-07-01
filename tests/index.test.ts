import { expect, test } from "bun:test";

import { version } from "../src/index.js";

test("package exposes a version string", () => {
    expect(typeof version).toBe("string");
});
