// Regressions from the 2026-09 review (see CHANGELOG).

import { expect, test } from "bun:test";
import { createHasuraClient } from "../../src/hasura/index.js";
import { createMockExecutor, type TestSchema } from "./fixtures.js";

function client(result: unknown) {
    const mock = createMockExecutor(result);
    const api = createHasuraClient<TestSchema>()({
        executor: mock.executor,
        defaultSelections: { User: "id" },
    });
    return { mock, api };
}

test("an empty _and list does not satisfy the whole-table mutation guard", async () => {
    const { api } = client({ update_User: { affected_rows: 0 } });
    await expect(Promise.resolve(
        api.table("User").where({ _and: [] }).update({ email: "x" }),
    )).rejects.toThrow("update() requires a where filter");
    await expect(Promise.resolve(
        api.table("User").where({ _and: [ {}, { _and: [] } ] }).remove(),
    )).rejects.toThrow("remove() requires a where filter");
});

test("a non-empty _and still counts as a filter", async () => {
    const { mock, api } = client({ delete_User: { affected_rows: 1 } });
    await api.table("User").where({ _and: [ {}, { age: { _eq: 1 } } ] })
        .remove();
    expect(mock.requests[0]?.variables.where).toEqual({
        _and: [ {}, { age: { _eq: 1 } } ],
    });
});

test("order(), insert() and update() snapshot caller-owned objects", async () => {
    const { mock, api } = client([]);
    const order = { age: "asc" as const };
    const ordered = api.table("User").order(order);
    (order as Record<string, string>).age = "desc";
    await ordered;
    expect(mock.requests[0]?.variables.order).toEqual({ age: "asc" });

    const row = { email: "a@b.c" };
    const inserting = api.table("User").insert(row);
    row.email = "changed";
    await inserting;
    expect(mock.requests[1]?.variables.input).toEqual([ { email: "a@b.c" } ]);

    const patch = { email: "a@b.c" };
    const updating = api.table("User").eq("age", 1).update(patch);
    patch.email = "changed";
    await updating;
    expect(mock.requests[2]?.variables.input).toEqual({ email: "a@b.c" });
});
