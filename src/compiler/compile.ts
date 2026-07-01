import type { GraphQLError } from "../diagnostics.js";
import type { GraphQLSchema } from "../schema.js";
import type {
    IndexGraphQL,
    OperationEntry,
    SelectOperation,
} from "./document.js";
import type { CompileSelection, SelectionSuccess } from "./selection.js";
import type { ResolveVariables } from "./variables.js";

export interface CompileSuccess<Result, Variables = {}> {
    result: Result;
    variables: Variables;
}

type RootType<S extends GraphQLSchema, Kind extends string> =
    S extends { rootTypes: infer Roots }
        ? Kind extends keyof Roots
            ? Roots[Kind] extends string ? Roots[Kind]
            : Capitalize<Kind>
            : Capitalize<Kind>
        : Capitalize<Kind>;

export type CompileGraphQL<
    Query extends string,
    S extends GraphQLSchema,
    OperationName extends string | undefined = undefined,
> = IndexGraphQL<Query, S> extends infer Index
    ? Index extends GraphQLError ? Index
    : Index extends {
        operations: infer Operations;
        fragments: infer Fragments;
    }
        ? SelectOperation<Operations, OperationName> extends infer Operation
            ? Operation extends GraphQLError ? Operation
            : Operation extends OperationEntry<
                string | undefined,
                infer Kind,
                infer VariableSource extends string | undefined,
                infer Selection,
                infer OperationDirectiveUses
            >
                ? CompileSelection<
                    Selection,
                    S,
                    RootType<S, Kind>,
                    Fragments
                > extends infer Compiled
                    ? Compiled extends GraphQLError ? Compiled
                    : Compiled extends SelectionSuccess<infer Result, infer Uses>
                        ? ResolveVariables<
                            VariableSource,
                            Uses | OperationDirectiveUses,
                            S,
                            S["defaultSchema"]
                        > extends infer Variables
                            ? Variables extends GraphQLError ? Variables
                            : CompileSuccess<Result, Variables>
                            : never
                        : GraphQLError<"SYNTAX_ERROR", "could not compile selection">
                    : never
                : GraphQLError<"SYNTAX_ERROR", "could not select operation">
            : never
        : GraphQLError<"SYNTAX_ERROR", "could not index document">
    : never;
