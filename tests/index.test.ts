import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { version } from "../src/index.js";

test("package exposes the package.json version", () => {
    const packageJson = JSON.parse(
        readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    expect(version).toBe(packageJson.version);
});
