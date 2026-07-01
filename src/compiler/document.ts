import type { GraphQLError } from "../diagnostics.js";
import type { GraphQLSchema } from "../schema.js";
import type { DirectivesResult, TakeDirectives } from "./directives.js";
import type {
    Match,
    SkipIgnored,
    TakeBraced,
    TakeName,
    TakeParenthesized,
} from "./scanner.js";

export type OperationKind = "query" | "mutation" | "subscription";

export interface OperationEntry<
    Name extends string | undefined = string | undefined,
    Kind extends OperationKind = OperationKind,
    Variables extends string | undefined = string | undefined,
    Selection extends string = string,
    DirectiveUses = never,
> {
    name: Name;
    kind: Kind;
    variables: Variables;
    selection: Selection;
    directiveUses: DirectiveUses;
}

export interface FragmentEntry<
    Name extends string = string,
    On extends string = string,
    Selection extends string = string,
    DirectiveUses = never,
> {
    name: Name;
    on: On;
    selection: Selection;
    directiveUses: DirectiveUses;
}

export interface DocumentIndex<Operations, Fragments> {
    operations: Operations;
    fragments: Fragments;
}

type OperationDirectiveLocation<Kind extends OperationKind> =
    Kind extends "query" ? "QUERY"
    : Kind extends "mutation" ? "MUTATION"
    : "SUBSCRIPTION";

type TypeNamespace<Ref extends string, Default extends string> =
    Ref extends `${infer Namespace}.${string}` ? Namespace : Default;

type ParseOperationTail<
    S extends string,
    Schema extends GraphQLSchema,
    Kind extends OperationKind,
    Operations,
    Fragments,
> = SkipIgnored<S> extends infer Start extends string
    ? Start extends `(${string}` | `@${string}` | `{${string}`
        ? ParseOperationBody<Start, Schema, undefined, Kind, Operations, Fragments>
        : TakeName<Start> extends Match<
            infer Name extends string,
            infer Rest extends string
        >
            ? ParseOperationBody<Rest, Schema, Name, Kind, Operations, Fragments>
            : TakeName<Start>
    : never;

type ParseOperationBody<
    S extends string,
    Schema extends GraphQLSchema,
    Name extends string | undefined,
    Kind extends OperationKind,
    Operations,
    Fragments,
    Variables extends string | undefined = undefined,
    DirectiveUses = never,
> = SkipIgnored<S> extends `(${string}`
    ? TakeParenthesized<S> extends Match<
        infer Vars extends string,
        infer Rest extends string
    >
        ? ParseOperationBody<Rest, Schema, Name, Kind, Operations, Fragments, Vars, DirectiveUses>
        : TakeParenthesized<S>
    : TakeDirectives<
        S,
        Schema,
        OperationDirectiveLocation<Kind>,
        Schema["defaultSchema"],
        false,
        DirectiveUses
    > extends DirectivesResult<
        infer Rest extends string,
        boolean,
        infer OperationDirectiveUses
    >
        ? TakeBraced<Rest> extends Match<
            infer Selection extends string,
            infer After extends string
        >
            ? HasNamed<Operations, Name> extends true
                ? GraphQLError<
                    "DUPLICATE_OPERATION",
                    `duplicate operation: ${Name extends string ? Name : "<anonymous>"}`
                >
                : IndexDocument<
                    After,
                    Schema,
                    Operations | OperationEntry<
                        Name,
                        Kind,
                        Variables,
                        Selection,
                        OperationDirectiveUses
                    >,
                    Fragments
                >
            : TakeBraced<Rest>
        : TakeDirectives<
            S,
            Schema,
            OperationDirectiveLocation<Kind>,
            Schema["defaultSchema"],
            false,
            DirectiveUses
        >;

type ParseFragment<
    S extends string,
    Schema extends GraphQLSchema,
    Operations,
    Fragments,
> =
    TakeName<S> extends Match<
        infer Name extends string,
        infer AfterName extends string
    >
        ? Name extends "on"
            ? GraphQLError<"SYNTAX_ERROR", "fragment name cannot be `on`">
            : TakeName<AfterName> extends Match<
                infer OnKeyword extends string,
                infer AfterOn extends string
            >
                ? OnKeyword extends "on"
                    ? TakeName<AfterOn> extends Match<
                        infer TypeName extends string,
                        infer AfterType extends string
                    >
                        ? TakeDirectives<
                            AfterType,
                            Schema,
                            "FRAGMENT_DEFINITION",
                            TypeNamespace<TypeName, Schema["defaultSchema"]>
                        > extends DirectivesResult<
                            infer BeforeSelection extends string,
                            boolean,
                            infer FragmentDirectiveUses
                        >
                            ? TakeBraced<BeforeSelection> extends Match<
                                infer Selection extends string,
                                infer Rest extends string
                            >
                                ? HasNamed<Fragments, Name> extends true
                                    ? GraphQLError<
                                        "DUPLICATE_FRAGMENT",
                                        `duplicate fragment: ${Name}`
                                    >
                                    : IndexDocument<
                                        Rest,
                                        Schema,
                                        Operations,
                                        Fragments | FragmentEntry<
                                            Name,
                                            TypeName,
                                            Selection,
                                            FragmentDirectiveUses
                                        >
                                    >
                                : TakeBraced<BeforeSelection>
                            : TakeDirectives<
                                AfterType,
                                Schema,
                                "FRAGMENT_DEFINITION",
                                TypeNamespace<TypeName, Schema["defaultSchema"]>
                            >
                        : TakeName<AfterOn>
                    : GraphQLError<"SYNTAX_ERROR", "expected `on` in fragment definition">
                : TakeName<AfterName>
        : TakeName<S>;

type HasNamed<T, Name> = [Extract<T, { name: Name }>] extends [never] ? false : true;

type IndexDocument<
    S extends string,
    Schema extends GraphQLSchema,
    Operations = never,
    Fragments = never,
> =
    SkipIgnored<S> extends infer Start extends string
        ? Start extends ""
            ? DocumentIndex<Operations, Fragments>
            : Start extends `{${string}`
                ? HasNamed<Operations, undefined> extends true
                    ? GraphQLError<"DUPLICATE_OPERATION", "multiple anonymous operations">
                    : TakeBraced<Start> extends Match<
                        infer Selection extends string,
                        infer Rest extends string
                    >
                        ? IndexDocument<
                            Rest,
                            Schema,
                            Operations | OperationEntry<undefined, "query", undefined, Selection>,
                            Fragments
                        >
                        : TakeBraced<Start>
                : TakeName<Start> extends Match<
                    infer Keyword extends string,
                    infer Rest extends string
                >
                    ? Keyword extends OperationKind
                        ? ParseOperationTail<Rest, Schema, Keyword, Operations, Fragments>
                        : Keyword extends "fragment"
                            ? ParseFragment<Rest, Schema, Operations, Fragments>
                            : GraphQLError<
                                "UNEXPECTED_TOKEN",
                                `unexpected document definition: ${Keyword}`
                            >
                    : TakeName<Start>
        : never;

export type IndexGraphQL<
    Source extends string,
    Schema extends GraphQLSchema,
> =
    string extends Source
        ? GraphQLError<"NON_LITERAL_QUERY", "GraphQL source must be a string literal">
        : IndexDocument<Source, Schema>;

type IsUnion<T, Whole = T> =
    T extends unknown ? [Whole] extends [T] ? false : true : never;

export type SelectOperation<Operations, Name extends string | undefined> =
    Name extends string
        ? Extract<Operations, { name: Name }> extends infer Found
            ? [Found] extends [never]
                ? GraphQLError<"UNKNOWN_OPERATION", `unknown operation: ${Name}`>
                : Found
            : never
        : [Operations] extends [never]
            ? GraphQLError<"SYNTAX_ERROR", "document has no operation">
            : true extends IsUnion<Operations>
                ? GraphQLError<
                    "OPERATION_NAME_REQUIRED",
                    "operation name is required for a multi-operation document"
                >
                : Operations;
