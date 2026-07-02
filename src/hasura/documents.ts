// Hasura document generators. Each produces a complete GraphQLRequest:
// document text (stable single-line whitespace), variables, operation name,
// kind, and resultPath. Payloads (where/order/input/conflict) always travel
// as variables, never inline; only selection structure is generated text.

import {
    buildFieldArguments,
    buildOperationDocument,
    type VariableDefinition,
} from "../runtime/document.js";
import type { GraphQLRequest } from "../runtime/request.js";

export interface ConflictSpec {
    constraint: string;
    update_columns: readonly string[];
}

export interface AggregateSelectionInput {
    count?: true | { columns?: string; distinct?: boolean; };
    max?: readonly string[];
    min?: readonly string[];
    avg?: readonly string[];
    sum?: readonly string[];
}

type FieldArgument = { name: string; variable: string; };

const GRAPHQL_NAME = /^[_A-Za-z][_0-9A-Za-z]*$/;

// Compile-time constraints on table()/select()/aggregate() are erased at
// runtime, so every identifier that lands in document text verbatim is
// re-checked here, at the single point where documents are assembled.
function assertGraphQLName(value: string, what: string): void {
    if (!GRAPHQL_NAME.test(value)) {
        throw new Error(
            `invalid GraphQL name for ${what}: ${JSON.stringify(value)}`,
        );
    }
}

// Selections are caller-supplied text (select()/customSelect()/
// defaultSelections). A full parse is out of scope at runtime, but the
// document shape is defended: braces and parens must balance and never
// close more than they opened, so injected text cannot break out of the
// `{ selection }` wrapper and plant fields or operations outside the
// intended table field. Strings and comments are skipped so brace-like
// argument values cannot trip the guard.
function assertEnclosedSelection(selection: string): void {
    let braces = 0;
    let parens = 0;
    for (let i = 0; i < selection.length; i++) {
        const ch = selection[i];
        if (ch === "\"") {
            const block = selection.startsWith("\"\"\"", i);
            let j = i + (block ? 3 : 1);
            for (;;) {
                if (j >= selection.length) {
                    throw new Error(
                        `unterminated string in selection: ${selection}`,
                    );
                }
                if (selection[j] === "\\") {
                    j += block && selection.startsWith("\"\"\"", j + 1)
                        ? 4
                        : block
                        ? 1
                        : 2;
                    continue;
                }
                if (block ? selection.startsWith("\"\"\"", j) : selection[j] === "\"") {
                    break;
                }
                j++;
            }
            i = j + (block ? 2 : 0);
        } else if (ch === "#") {
            const newline = selection.indexOf("\n", i);
            i = newline === -1 ? selection.length : newline;
        } else if (ch === "{") {
            braces++;
        } else if (ch === "}") {
            if (--braces < 0) {
                throw new Error(
                    `selection must stay inside its enclosing braces: ${selection}`,
                );
            }
        } else if (ch === "(") {
            parens++;
        } else if (ch === ")") {
            if (--parens < 0) {
                throw new Error(
                    `unbalanced parentheses in selection: ${selection}`,
                );
            }
        }
    }
    if (braces !== 0) {
        throw new Error(`unbalanced braces in selection: ${selection}`);
    }
    if (parens !== 0) {
        throw new Error(`unbalanced parentheses in selection: ${selection}`);
    }
}

type ListRequestArgs = {
    table: string;
    selection: string;
    where?: unknown;
    order?: unknown;
    offset?: number;
    limit?: number;
    distinctOn?: string;
    kind?: "query" | "subscription";
};

export function buildListRequest(args: ListRequestArgs): GraphQLRequest {
    assertGraphQLName(args.table, "table");
    assertEnclosedSelection(args.selection);
    const kind = args.kind ?? "query";
    const defs: VariableDefinition[] = [];
    const fieldArgs: FieldArgument[] = [];
    const variables: Record<string, unknown> = {};
    if (args.where !== undefined) {
        defs.push({ name: "where", type: `${args.table}_bool_exp` });
        fieldArgs.push({ name: "where", variable: "where" });
        variables.where = args.where;
    }
    if (args.order !== undefined) {
        defs.push({ name: "order", type: `[${args.table}_order_by!]` });
        fieldArgs.push({ name: "order_by", variable: "order" });
        variables.order = args.order;
    }
    if (args.offset !== undefined) {
        defs.push({ name: "offset", type: "Int" });
        fieldArgs.push({ name: "offset", variable: "offset" });
        variables.offset = args.offset;
    }
    if (args.limit !== undefined) {
        defs.push({ name: "limit", type: "Int" });
        fieldArgs.push({ name: "limit", variable: "limit" });
        variables.limit = args.limit;
    }
    if (args.distinctOn !== undefined) {
        defs.push({
            name: "distinct_on",
            type: `[${args.table}_select_column!]`,
        });
        fieldArgs.push({ name: "distinct_on", variable: "distinct_on" });
        variables.distinct_on = args.distinctOn;
    }
    const name = `List${args.table}s`;
    return {
        document: buildOperationDocument({
            kind,
            name,
            variableDefinitions: defs,
            selection: `${args.table}${
                buildFieldArguments(fieldArgs)
            } { ${args.selection} }`,
        }),
        variables,
        operationName: name,
        kind,
        resultPath: [ args.table ],
    };
}

type InsertRequestArgs = {
    table: string;
    selection: string;
    data: unknown;
    /** `false` = insert-or-ignore: primary-key constraint with empty
     *  update_columns. `undefined` = no on_conflict clause. */
    conflict?: ConflictSpec | false;
};

export function buildInsertRequest(args: InsertRequestArgs): GraphQLRequest {
    assertGraphQLName(args.table, "table");
    assertEnclosedSelection(args.selection);
    const objects = Array.isArray(args.data) ? args.data : [ args.data ];
    const conflict: ConflictSpec | undefined = args.conflict === false
        ? { constraint: `${args.table}_pkey`, update_columns: [] }
        : args.conflict;
    const defs: VariableDefinition[] = [
        { name: "input", type: `[${args.table}_insert_input!]!` },
    ];
    const fieldArgs: FieldArgument[] = [
        { name: "objects", variable: "input" },
    ];
    const variables: Record<string, unknown> = { input: objects };
    if (conflict !== undefined) {
        defs.push({ name: "conflict", type: `${args.table}_on_conflict` });
        fieldArgs.push({ name: "on_conflict", variable: "conflict" });
        variables.conflict = conflict;
    }
    const name = `Insert${args.table}`;
    return {
        document: buildOperationDocument({
            kind: "mutation",
            name,
            variableDefinitions: defs,
            selection: `insert_${args.table}${
                buildFieldArguments(fieldArgs)
            } { returning { ${args.selection} } }`,
        }),
        variables,
        operationName: name,
        kind: "mutation",
        resultPath: [ `insert_${args.table}`, "returning" ],
    };
}

export function buildUpdateRequest(args: {
    table: string;
    where: unknown;
    data: unknown;
}): GraphQLRequest {
    assertGraphQLName(args.table, "table");
    const name = `Update${args.table}`;
    return {
        document: buildOperationDocument({
            kind: "mutation",
            name,
            variableDefinitions: [
                { name: "where", type: `${args.table}_bool_exp!` },
                { name: "input", type: `${args.table}_set_input!` },
            ],
            selection: `update_${args.table}(where: $where, _set: $input) `
                + `{ affected_rows }`,
        }),
        variables: { where: args.where, input: args.data },
        operationName: name,
        kind: "mutation",
        resultPath: [ `update_${args.table}` ],
    };
}

export function buildDeleteRequest(args: {
    table: string;
    where: unknown;
}): GraphQLRequest {
    assertGraphQLName(args.table, "table");
    const name = `Delete${args.table}`;
    return {
        document: buildOperationDocument({
            kind: "mutation",
            name,
            variableDefinitions: [
                { name: "where", type: `${args.table}_bool_exp!` },
            ],
            selection: `delete_${args.table}(where: $where) `
                + `{ affected_rows }`,
        }),
        variables: { where: args.where },
        operationName: name,
        kind: "mutation",
        resultPath: [ `delete_${args.table}` ],
    };
}

export function generateAggregateSelection(
    input: AggregateSelectionInput = {},
    nodes?: readonly string[],
): string {
    const aggParts: string[] = [];
    if (input.count === true) {
        aggParts.push("count");
    }
    else if (input.count !== undefined) {
        const parts: string[] = [];
        if (input.count.columns !== undefined) {
            assertGraphQLName(input.count.columns, "count column");
            parts.push(`columns: ${input.count.columns}`);
        }
        if (input.count.distinct !== undefined) {
            parts.push(`distinct: ${input.count.distinct ? "true" : "false"}`);
        }
        // GraphQL forbids empty argument lists; bare count counts all rows.
        aggParts.push(
            parts.length === 0 ? "count" : `count(${parts.join(", ")})`,
        );
    }
    for (const key of [ "max", "min", "avg", "sum" ] as const) {
        const columns = input[key];
        if (columns === undefined) {
            continue;
        }
        if (columns.length === 0) {
            throw new Error(`${key} must have at least one column`);
        }
        for (const column of columns) {
            assertGraphQLName(column, `${key} column`);
        }
        aggParts.push(`${key} { ${columns.join(" ")} }`);
    }
    const outputParts: string[] = [];
    if (aggParts.length > 0) {
        outputParts.push(`aggregate { ${aggParts.join(" ")} }`);
    }
    if (nodes !== undefined && nodes.length > 0) {
        for (const column of nodes) {
            assertGraphQLName(column, "nodes column");
        }
        outputParts.push(`nodes { ${nodes.join(" ")} }`);
    }
    if (outputParts.length === 0) {
        throw new Error(
            "aggregate requires at least one aggregate function or nodes selection",
        );
    }
    return outputParts.join(" ");
}

type AggregateRequestArgs = {
    table: string;
    aggregate?: AggregateSelectionInput;
    nodes?: readonly string[];
    where?: unknown;
    order?: unknown;
    offset?: number;
    limit?: number;
    distinctOn?: string;
    kind?: "query" | "subscription";
};

export function buildAggregateRequest(
    args: AggregateRequestArgs,
): GraphQLRequest {
    assertGraphQLName(args.table, "table");
    const kind = args.kind ?? "query";
    const defs: VariableDefinition[] = [];
    const fieldArgs: FieldArgument[] = [];
    const variables: Record<string, unknown> = {};
    if (args.where !== undefined) {
        defs.push({ name: "where", type: `${args.table}_bool_exp` });
        fieldArgs.push({ name: "where", variable: "where" });
        variables.where = args.where;
    }
    if (args.distinctOn !== undefined) {
        defs.push({
            name: "distinct_on",
            type: `[${args.table}_select_column!]`,
        });
        fieldArgs.push({ name: "distinct_on", variable: "distinct_on" });
        variables.distinct_on = args.distinctOn;
    }
    if (args.order !== undefined) {
        defs.push({ name: "order", type: `[${args.table}_order_by!]` });
        fieldArgs.push({ name: "order_by", variable: "order" });
        variables.order = args.order;
    }
    if (args.offset !== undefined) {
        defs.push({ name: "offset", type: "Int" });
        fieldArgs.push({ name: "offset", variable: "offset" });
        variables.offset = args.offset;
    }
    if (args.limit !== undefined) {
        defs.push({ name: "limit", type: "Int" });
        fieldArgs.push({ name: "limit", variable: "limit" });
        variables.limit = args.limit;
    }
    const name = `Aggregate${args.table}`;
    return {
        document: buildOperationDocument({
            kind,
            name,
            variableDefinitions: defs,
            selection: `${args.table}_aggregate${
                buildFieldArguments(fieldArgs)
            } { ${generateAggregateSelection(args.aggregate, args.nodes)} }`,
        }),
        variables,
        operationName: name,
        kind,
        resultPath: [ `${args.table}_aggregate` ],
    };
}
