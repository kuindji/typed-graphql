import { expect, test } from "bun:test";

import {
    buildFieldArguments,
    buildOperationDocument,
} from "../../src/runtime/document.js";

test("buildOperationDocument renders kind, name, variables, selection", () => {
    const document = buildOperationDocument({
        kind: "query",
        name: "ListUsers",
        variableDefinitions: [
            { name: "where", type: "User_bool_exp" },
            { name: "limit", type: "Int" },
        ],
        selection: "User(where: $where, limit: $limit) { id email }",
    });
    expect(document).toBe(
        "query ListUsers($where: User_bool_exp, $limit: Int) "
            + "{ User(where: $where, limit: $limit) { id email } }",
    );
});

test("buildOperationDocument omits the variable list when empty", () => {
    expect(buildOperationDocument({
        kind: "subscription",
        name: "ListUsers",
        selection: "User { id }",
    })).toBe("subscription ListUsers { User { id } }");
    expect(buildOperationDocument({
        kind: "mutation",
        name: "DeleteUser",
        variableDefinitions: [],
        selection: "delete_User { affected_rows }",
    })).toBe("mutation DeleteUser { delete_User { affected_rows } }");
});

test("buildFieldArguments renders a parenthesized list or empty string", () => {
    expect(buildFieldArguments([
        { name: "where", variable: "where" },
        { name: "order_by", variable: "order" },
    ])).toBe("(where: $where, order_by: $order)");
    expect(buildFieldArguments([])).toBe("");
});
