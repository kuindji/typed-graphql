import { expect, test } from "bun:test";

import {
    buildAggregateRequest,
    buildDeleteRequest,
    buildInsertRequest,
    buildListRequest,
    buildUpdateRequest,
    generateAggregateSelection,
} from "../../src/hasura/documents.js";

test("buildListRequest declares only the variables that are set", () => {
    const request = buildListRequest({
        table: "User",
        selection: "id email",
        where: { active: { _eq: true } },
        limit: 10,
    });
    expect(request.document).toBe(
        "query ListUsers($where: User_bool_exp, $limit: Int) "
            + "{ User(where: $where, limit: $limit) { id email } }",
    );
    expect(request.variables).toEqual({
        where: { active: { _eq: true } },
        limit: 10,
    });
    expect(request.kind).toBe("query");
    expect(request.operationName).toBe("ListUsers");
    expect(request.resultPath).toEqual([ "User" ]);
});

test("buildListRequest supports every list variable and subscriptions", () => {
    const request = buildListRequest({
        table: "Post",
        selection: "id",
        where: {},
        order: { title: "asc" },
        offset: 5,
        limit: 2,
        distinctOn: "title",
        kind: "subscription",
    });
    expect(request.document).toBe(
        "subscription ListPosts($where: Post_bool_exp, "
            + "$order: [Post_order_by!], $offset: Int, $limit: Int, "
            + "$distinct_on: [Post_select_column!]) "
            + "{ Post(where: $where, order_by: $order, offset: $offset, "
            + "limit: $limit, distinct_on: $distinct_on) { id } }",
    );
    expect(request.variables.distinct_on).toBe("title");
    expect(request.kind).toBe("subscription");
});

test("buildInsertRequest normalizes data and handles conflict variants", () => {
    const single = buildInsertRequest({
        table: "User",
        selection: "id",
        data: { id: "1" },
    });
    expect(single.document).toBe(
        "mutation InsertUser($input: [User_insert_input!]!) "
            + "{ insert_User(objects: $input) { returning { id } } }",
    );
    expect(single.variables).toEqual({ input: [ { id: "1" } ] });
    expect(single.kind).toBe("mutation");
    expect(single.resultPath).toEqual([ "insert_User", "returning" ]);

    const ignore = buildInsertRequest({
        table: "User",
        selection: "id",
        data: [ { id: "1" }, { id: "2" } ],
        conflict: false,
    });
    expect(ignore.document).toBe(
        "mutation InsertUser($input: [User_insert_input!]!, "
            + "$conflict: User_on_conflict) "
            + "{ insert_User(objects: $input, on_conflict: $conflict) "
            + "{ returning { id } } }",
    );
    expect(ignore.variables.conflict).toEqual({
        constraint: "User_pkey",
        update_columns: [],
    });
    expect(ignore.variables.input).toEqual([ { id: "1" }, { id: "2" } ]);
});

test("buildUpdateRequest and buildDeleteRequest target affected_rows", () => {
    const update = buildUpdateRequest({
        table: "User",
        where: { id: { _eq: "1" } },
        data: { email: "a@b.c" },
    });
    expect(update.document).toBe(
        "mutation UpdateUser($where: User_bool_exp!, $input: User_set_input!) "
            + "{ update_User(where: $where, _set: $input) { affected_rows } }",
    );
    expect(update.variables).toEqual({
        where: { id: { _eq: "1" } },
        input: { email: "a@b.c" },
    });
    expect(update.resultPath).toEqual([ "update_User" ]);

    const remove = buildDeleteRequest({
        table: "User",
        where: { id: { _eq: "1" } },
    });
    expect(remove.document).toBe(
        "mutation DeleteUser($where: User_bool_exp!) "
            + "{ delete_User(where: $where) { affected_rows } }",
    );
    expect(remove.resultPath).toEqual([ "delete_User" ]);
});

test("generateAggregateSelection ports TheFloorr behavior", () => {
    expect(generateAggregateSelection({ count: true })).toBe(
        "aggregate { count }",
    );
    // empty argument lists are invalid GraphQL — bare count instead
    expect(generateAggregateSelection({ count: {} })).toBe(
        "aggregate { count }",
    );
    expect(generateAggregateSelection(
        { count: { columns: "id", distinct: true }, max: [ "age" ] },
        [ "id", "email" ],
    )).toBe(
        "aggregate { count(columns: id, distinct: true) max { age } } "
            + "nodes { id email }",
    );
    expect(() => generateAggregateSelection({ max: [] as never }))
        .toThrow("max must have at least one column");
    expect(() => generateAggregateSelection({})).toThrow(
        "aggregate requires at least one aggregate function or nodes selection",
    );
});

test("buildAggregateRequest wraps the aggregate selection", () => {
    const request = buildAggregateRequest({
        table: "User",
        aggregate: { count: true },
        where: { active: { _eq: true } },
        kind: "subscription",
    });
    expect(request.document).toBe(
        "subscription AggregateUser($where: User_bool_exp) "
            + "{ User_aggregate(where: $where) { aggregate { count } } }",
    );
    expect(request.kind).toBe("subscription");
    expect(request.resultPath).toEqual([ "User_aggregate" ]);
});

test("table names are validated as GraphQL names at build time", () => {
    // The type constraint on table() is erased at runtime; a raw string
    // reaching the document builders must not be interpolated verbatim.
    const evil = "User { id } evil";
    expect(() => buildListRequest({ table: evil, selection: "id" }))
        .toThrow('invalid GraphQL name for table: "User { id } evil"');
    expect(() => buildInsertRequest({ table: evil, selection: "id", data: {} }))
        .toThrow("invalid GraphQL name for table");
    expect(() => buildUpdateRequest({ table: evil, where: { a: 1 }, data: {} }))
        .toThrow("invalid GraphQL name for table");
    expect(() => buildDeleteRequest({ table: evil, where: { a: 1 } }))
        .toThrow("invalid GraphQL name for table");
    expect(() => buildAggregateRequest({ table: evil }))
        .toThrow("invalid GraphQL name for table");
});

test("a selection cannot escape its enclosing braces", () => {
    // Balanced overall, but the leading } closes the wrapping field and
    // plants a sibling root field outside the intended table.
    expect(() =>
        buildListRequest({
            table: "User",
            selection: "id } Secret { token",
        })
    ).toThrow("selection must stay inside its enclosing braces");
    // Unbalanced selections malform the document.
    expect(() => buildListRequest({ table: "User", selection: "id {" }))
        .toThrow("unbalanced braces in selection");
    expect(() =>
        buildInsertRequest({
            table: "User",
            selection: "id } } mutation Evil { x",
            data: {},
        })
    ).toThrow("selection must stay inside its enclosing braces");
});

test("brace-like content inside strings and comments does not trip the selection guard", () => {
    const request = buildListRequest({
        table: "User",
        selection: 'posts(kind: "}") { id # {\n title }',
    });
    expect(request.document).toBe(
        'query ListUsers { User { posts(kind: "}") { id # {\n title } } }',
    );
    expect(() =>
        buildListRequest({ table: "User", selection: 'id name(x: "' })
    ).toThrow("unterminated string in selection");
});

test("a trailing selection comment cannot consume generated closing braces", () => {
    const list = buildListRequest({
        table: "User",
        selection: "id # trailing",
    });
    expect(list.document).toBe(
        "query ListUsers { User { id # trailing\n } }",
    );

    const insert = buildInsertRequest({
        table: "User",
        selection: "id # trailing",
        data: {},
    });
    expect(insert.document).toBe(
        "mutation InsertUser($input: [User_insert_input!]!) "
            + "{ insert_User(objects: $input) { returning { id # trailing\n } } }",
    );
});

test("aggregate column names are validated as GraphQL names", () => {
    expect(() => generateAggregateSelection({ max: [ "id) { x" ] }))
        .toThrow('invalid GraphQL name for max column: "id) { x"');
    expect(() =>
        generateAggregateSelection({ count: { columns: "id) x" } })
    ).toThrow("invalid GraphQL name for count column");
    expect(() => generateAggregateSelection({ count: true }, [ "a b" ]))
        .toThrow("invalid GraphQL name for nodes column");
});
