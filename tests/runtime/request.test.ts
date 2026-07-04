import { expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import type {
    GraphQLExecuteResult,
    GraphQLExecutor,
    GraphQLRequest,
} from "../../src/runtime/request.js";
import {
    extractErrors,
    extractResult,
    GraphQLResponseError,
    unwrapResponse,
} from "../../src/runtime/request.js";

test("extractResult returns data unchanged when no path is given", () => {
    const data = { User: [ { id: "1" } ] };
    expect(extractResult(data)).toBe(data);
    expect(extractResult(data, [])).toBe(data);
});

test("extractResult unwraps along the result path", () => {
    const data = { insert_User: { returning: [ { id: "1" } ] } };
    expect(extractResult(data, [ "insert_User", "returning" ]))
        .toEqual([ { id: "1" } ]);
});

test("extractResult returns null for missing segments and non-objects", () => {
    expect(extractResult(null, [ "User" ])).toBeNull();
    expect(extractResult(undefined, [ "User" ])).toBeNull();
    expect(extractResult({}, [ "User" ])).toBeNull();
    expect(extractResult({ User: null }, [ "User", "x" ])).toBeNull();
    expect(extractResult("scalar", [ "User" ])).toBeNull();
});

test("extractErrors returns the response errors or an empty list", () => {
    expect(extractErrors({ data: null, errors: [ { message: "boom" } ] }))
        .toEqual([ { message: "boom" } ]);
    expect(extractErrors({ data: {} })).toEqual([]);
    expect(extractErrors({ data: {}, errors: [] })).toEqual([]);
    expect(extractErrors(null)).toEqual([]);
    expect(extractErrors("nope")).toEqual([]);
    expect(extractErrors({ errors: "nope" })).toEqual([]);
});

test("unwrapResponse returns data and throws GraphQLResponseError on errors", () => {
    const data = { User: [] };
    expect(unwrapResponse({ data })).toBe(data);
    expect(unwrapResponse({ data: null })).toBeNull();

    let caught: unknown;
    try {
        unwrapResponse({
            data: null,
            errors: [ { message: "boom" }, { message: "again" } ],
        });
    } catch (error) {
        caught = error;
    }
    expect(caught).toBeInstanceOf(GraphQLResponseError);
    expect((caught as GraphQLResponseError).errors).toEqual([
        { message: "boom" },
        { message: "again" },
    ]);
    expect((caught as GraphQLResponseError).message).toContain("boom");
});

test("unwrapResponse rejects values that are not response envelopes", () => {
    expect(() => unwrapResponse(null)).toThrow(
        "GraphQL response is not an object",
    );
    expect(() => unwrapResponse({ User: [] })).toThrow(
        'GraphQL response has neither "data" nor "errors"',
    );
});

test("request and executor types have the documented shape", () => {
    expectTypeOf<GraphQLRequest["kind"]>().toEqualTypeOf<
        "query" | "mutation" | "subscription"
    >();
    expectTypeOf<GraphQLRequest["variables"]>().toEqualTypeOf<
        Record<string, unknown>
    >();
    expectTypeOf<GraphQLExecutor["execute"]>().toEqualTypeOf<
        (request: GraphQLRequest) => Promise<GraphQLExecuteResult>
    >();
    expectTypeOf<NonNullable<GraphQLExecutor["subscribe"]>>().returns
        .toEqualTypeOf<() => void>();
});
