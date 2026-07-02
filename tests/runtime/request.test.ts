import { expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import type {
    GraphQLExecutor,
    GraphQLRequest,
} from "../../src/runtime/request.js";
import { extractResult } from "../../src/runtime/request.js";

test("extractResult returns data unchanged when no path is given", () => {
    const data = { User: [{ id: "1" }] };
    expect(extractResult(data)).toBe(data);
    expect(extractResult(data, [])).toBe(data);
});

test("extractResult unwraps along the result path", () => {
    const data = { insert_User: { returning: [{ id: "1" }] } };
    expect(extractResult(data, ["insert_User", "returning"]))
        .toEqual([{ id: "1" }]);
});

test("extractResult returns null for missing segments and non-objects", () => {
    expect(extractResult(null, ["User"])).toBeNull();
    expect(extractResult(undefined, ["User"])).toBeNull();
    expect(extractResult({}, ["User"])).toBeNull();
    expect(extractResult({ User: null }, ["User", "x"])).toBeNull();
    expect(extractResult("scalar", ["User"])).toBeNull();
});

test("request and executor types have the documented shape", () => {
    expectTypeOf<GraphQLRequest["kind"]>().toEqualTypeOf<
        "query" | "mutation" | "subscription"
    >();
    expectTypeOf<GraphQLRequest["variables"]>().toEqualTypeOf<
        Record<string, unknown>
    >();
    expectTypeOf<GraphQLExecutor["execute"]>().toEqualTypeOf<
        (request: GraphQLRequest) => Promise<unknown>
    >();
    expectTypeOf<NonNullable<GraphQLExecutor["subscribe"]>>().returns
        .toEqualTypeOf<() => void>();
});
