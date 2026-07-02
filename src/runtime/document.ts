// Generic operation-document assembly. Hasura (and future builders) compose
// these helpers; output whitespace is stable and minimal: a single line with
// single spaces, so tests and consumers can assert document text exactly.

import type { GraphQLRequestKind } from "./request.js";

export interface VariableDefinition {
    name: string;
    type: string;
}

export interface OperationOptions {
    kind: GraphQLRequestKind;
    name: string;
    variableDefinitions?: readonly VariableDefinition[];
    selection: string;
}

export function buildOperationDocument(options: OperationOptions): string {
    const defs = options.variableDefinitions ?? [];
    const header = defs.length === 0
        ? `${options.kind} ${options.name}`
        : `${options.kind} ${options.name}(${
            defs.map((d) => `$${d.name}: ${d.type}`).join(", ")
        })`;
    return `${header} { ${options.selection} }`;
}

export function buildFieldArguments(
    args: readonly { name: string; variable: string }[],
): string {
    if (args.length === 0) {
        return "";
    }
    return `(${args.map((a) => `${a.name}: $${a.variable}`).join(", ")})`;
}
