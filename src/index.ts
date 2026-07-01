// @kuindji/typed-graphql
//
// Compile-time GraphQL query validation and result-type inference for
// TypeScript. Scaffold only — the type-level engine is not implemented yet.
// The public API (e.g. `ValidateGraphQL`, `GetReturnType`, `GraphQLSchema`)
// will be added in subsequent work.

export const version = "0.0.0";

export type { ParseSelection } from "./parsing/parser.js";
export type { GraphQLError } from "./diagnostics.js";
export { Kind, OperationTypeNode } from "./parsing/ast.js";

import type { ParseDocument } from "./parsing/parser.js";

// Parse a GraphQL document literal into a type-level AST, or a GraphQLError.
export type ParseGraphQL<In extends string> = ParseDocument<In>;
