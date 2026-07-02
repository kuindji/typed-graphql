import type { GraphQLError } from "../diagnostics.js";
import type { GraphQLSchema } from "../schema.js";
import type {
    IndexGraphQL,
    OperationEntry,
    SelectOperation,
} from "./document.js";
import type {
    IsUnionSource,
    Match,
    SkipIgnored,
    TakeName,
    TakeParenthesized,
    UnionSourceError,
} from "./scanner.js";
import type { CompileSelection, SelectionSuccess } from "./selection.js";
import type { ResolveVariables } from "./variables.js";

// Spec §5.5.1.4: every fragment defined in a document must be spread somewhere
// in that document. The selection compiler only walks fragments reachable from
// the *selected* operation, so a fragment nobody spreads — including a
// structurally broken one (`fragment F on Nonexistent { ... }`) — was never
// examined. We collect every spread target across all operation and fragment
// selections and flag any defined fragment that is not among them.
interface SpreadChunk<S extends string, Acc> {
    __spreadChunk: [S, Acc];
}
interface SpreadDone<Acc> {
    __spreadDone: Acc;
}

// Walks a selection source collecting `...Name` spread targets. Spreads only
// occur at selection-set level; argument lists (which may hold string literals
// that happen to contain `...`) are skipped wholesale via TakeParenthesized, so
// every `...Name` reached is a real spread. `Name extends "on"` distinguishes a
// spread from an inline `... on Type` fragment. Chunked at 120 steps like the
// scanner's other workers.
type SpreadWorker<
    S extends string,
    Acc = never,
    Steps extends unknown[] = [],
> = Steps["length"] extends 120
    ? SpreadChunk<S, Acc>
    : SkipIgnored<S> extends infer T extends string
        ? T extends "" ? SpreadDone<Acc>
        : T extends `...${infer AfterDots extends string}`
            ? TakeName<AfterDots> extends Match<
                infer Name extends string,
                infer Rest extends string
            >
                ? Name extends "on"
                    ? SpreadWorker<AfterDots, Acc, [unknown, ...Steps]>
                    : SpreadWorker<Rest, Acc | Name, [unknown, ...Steps]>
                : SpreadWorker<AfterDots, Acc, [unknown, ...Steps]>
        : T extends `(${string}`
            ? TakeParenthesized<T> extends Match<
                infer _Group extends string,
                infer Rest extends string
            >
                ? SpreadWorker<Rest, Acc, [unknown, ...Steps]>
                : SpreadDone<Acc>
        : TakeName<T> extends Match<infer _Tok extends string, infer Rest extends string>
            ? SpreadWorker<Rest, Acc, [unknown, ...Steps]>
        : T extends `${infer _C}${infer Rest extends string}`
            ? SpreadWorker<Rest, Acc, [unknown, ...Steps]>
        : SpreadDone<Acc>
    : SpreadDone<Acc>;

// A selection is already length-bounded by the structural scan budget when it
// is indexed, so the 64-chunk cap here is unreachable; degrading to an empty
// set (rather than an error) keeps this rule lenient — it never invents a spurious
// UNUSED_FRAGMENT on input the rest of the compiler accepted.
type SpreadDrive<R, Chunks extends unknown[] = []> =
    Chunks["length"] extends 64
        ? SpreadDone<never>
        : R extends SpreadChunk<infer S extends string, infer Acc>
            ? SpreadDrive<SpreadWorker<S, Acc>, [unknown, ...Chunks]>
            : R;

type CollectSpreads<Sel extends string> =
    SpreadDrive<SpreadWorker<Sel>> extends SpreadDone<infer Acc> ? Acc : never;

type UsedFragmentNames<Operations, Fragments> =
    | (Operations extends { selection: infer Sel extends string } ? CollectSpreads<Sel> : never)
    | (Fragments extends { selection: infer Sel extends string } ? CollectSpreads<Sel> : never);

type UnusedFragmentNames<Fragments, Used> =
    Fragments extends { name: infer Name extends string }
        ? Name extends Used ? never : Name
        : never;

// `never` when every defined fragment is used, otherwise the UNUSED_FRAGMENT
// diagnostic. Short-circuits when no fragments exist so the spread scan never
// runs for the common fragment-free document.
type UnusedFragmentError<Operations, Fragments> =
    [Fragments] extends [never] ? never
        : UnusedFragmentNames<
            Fragments,
            UsedFragmentNames<Operations, Fragments>
        > extends infer Unused
            ? [Unused] extends [never] ? never
            : GraphQLError<
                "UNUSED_FRAGMENT",
                `fragment ${Unused & string} is defined but never used`
            >
            : never;

export interface CompileSuccess<Result, Variables = {}> {
    result: Result;
    variables: Variables;
}

type IsUnion<T, Whole = T> =
    T extends unknown ? [Whole] extends [T] ? false : true : never;

// Spec §5.2.3.1: a subscription selects exactly one root field. Fragment
// fields are already flattened into the compiled result, and merged
// selections of one field share a response key, so counting the result's
// keys matches the spec's CollectFields grouping.
type SingleRootViolation<Kind extends string, Result> =
    Kind extends "subscription"
        ? true extends IsUnion<keyof Result>
            ? GraphQLError<
                "SUBSCRIPTION_MULTIPLE_ROOT_FIELDS",
                "a subscription must select exactly one root field"
            >
            : never
        : never;

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
> = IsUnionSource<Query> extends true ? UnionSourceError
    : IndexGraphQL<Query, S> extends infer Index
    ? Index extends GraphQLError ? Index
    : Index extends {
        operations: infer Operations;
        fragments: infer Fragments;
    }
        ? UnusedFragmentError<Operations, Fragments> extends infer Unused
            ? [Unused] extends [never]
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
                        ? [SingleRootViolation<Kind, Result>] extends [never]
                            ? ResolveVariables<
                            VariableSource,
                            Uses | OperationDirectiveUses,
                            S,
                            S["defaultSchema"]
                            > extends infer Variables
                                ? Variables extends GraphQLError ? Variables
                                : CompileSuccess<Result, Variables>
                                : never
                            : SingleRootViolation<Kind, Result>
                        : GraphQLError<"SYNTAX_ERROR", "could not compile selection">
                    : never
                : GraphQLError<"SYNTAX_ERROR", "could not select operation">
            : never
                : Unused
            : never
        : GraphQLError<"SYNTAX_ERROR", "could not index document">
    : never;
