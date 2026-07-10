// @kuindji/typed-graphql
//
// Compile-time GraphQL query validation and result-type inference for
// TypeScript. The core is AST-less: it walks source strings directly and
// returns structured diagnostics for invalid syntax or schema mismatches.

export { version } from "./version.js";

export type { GraphQLError } from "./diagnostics.js";
export type {
    GraphQLAbstractType,
    GraphQLDirective,
    GraphQLInput,
    GraphQLRelation,
    GraphQLSchema,
} from "./schema.js";

import type { CompileGraphQL, CompileSuccess } from "./compiler/compile.js";
import type { CompileSelection, SelectionSuccess } from "./compiler/selection.js";
import type { GraphQLError } from "./diagnostics.js";
import type { GraphQLSchema } from "./schema.js";

export type ValidateGraphQL<
    Query extends string,
    Schema extends GraphQLSchema,
    OperationName extends string | undefined = undefined,
> = CompileGraphQL<Query, Schema, OperationName> extends infer Compiled
    ? Compiled extends GraphQLError ? Compiled : true
    : never;

export type IsValidGraphQL<
    Query extends string,
    Schema extends GraphQLSchema,
    OperationName extends string | undefined = undefined,
> = ValidateGraphQL<Query, Schema, OperationName> extends true ? true : false;

export type GetReturnType<
    Query extends string,
    Schema extends GraphQLSchema,
    OperationName extends string | undefined = undefined,
> = CompileGraphQL<Query, Schema, OperationName> extends CompileSuccess<
    infer Result,
    unknown
> ? Result
    : never;

export type GetVariables<
    Query extends string,
    Schema extends GraphQLSchema,
    OperationName extends string | undefined = undefined,
> = CompileGraphQL<Query, Schema, OperationName> extends CompileSuccess<
    unknown,
    infer Variables
> ? Variables
    : never;

export type ValidateSelection<
    Selection extends string,
    Schema extends GraphQLSchema,
    Root extends string,
> = CompileSelection<Selection, Schema, Root> extends infer Compiled
    ? Compiled extends GraphQLError ? Compiled : true
    : never;

export type GetSelectionType<
    Selection extends string,
    Schema extends GraphQLSchema,
    Root extends string,
> = CompileSelection<Selection, Schema, Root> extends SelectionSuccess<
    infer Result
> ? Result
    : never;
