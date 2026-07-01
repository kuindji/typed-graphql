import { expect, test } from "bun:test";
import { makeError } from "../src/diagnostics.js";

test("makeError brands a diagnostic with code and message", () => {
    const e = makeError("SYNTAX_ERROR", "unexpected token");
    expect(e.__graphqlError).toBe(true);
    expect(e.code).toBe("SYNTAX_ERROR");
});
