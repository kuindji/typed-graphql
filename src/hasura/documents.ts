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
            parts.push(`columns: ${input.count.columns}`);
        }
        if (input.count.distinct !== undefined) {
            parts.push(`distinct: ${input.count.distinct ? "true" : "false"}`);
        }
        aggParts.push(`count(${parts.join(", ")})`);
    }
    for (const key of [ "max", "min", "avg", "sum" ] as const) {
        const columns = input[key];
        if (columns === undefined) {
            continue;
        }
        if (columns.length === 0) {
            throw new Error(`${key} must have at least one column`);
        }
        aggParts.push(`${key} { ${columns.join(" ")} }`);
    }
    const outputParts: string[] = [];
    if (aggParts.length > 0) {
        outputParts.push(`aggregate { ${aggParts.join(" ")} }`);
    }
    if (nodes !== undefined && nodes.length > 0) {
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
    distinctOn?: string;
    kind?: "query" | "subscription";
};

export function buildAggregateRequest(
    args: AggregateRequestArgs,
): GraphQLRequest {
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
