import type { GraphQLError } from "../diagnostics.js";
import type {
    GraphQLAbstractType,
    GraphQLRelation,
    GraphQLSchema,
} from "../schema.js";
import type {
    ArgumentUses,
    SameArguments,
    ValidateArguments,
} from "./arguments.js";
import type { DirectivesResult, TakeDirectives } from "./directives.js";
import type { FragmentEntry } from "./document.js";
import type {
    Match,
    SkipIgnored,
    TakeBraced,
    TakeName,
    TakeParenthesized,
} from "./scanner.js";

interface TypeContext<
    Namespace extends string = string,
    Name extends string = string,
> {
    namespace: Namespace;
    name: Name;
}

interface FieldResult<
    Key extends string = string,
    Value = unknown,
    Optional extends boolean = boolean,
    Uses = never,
    FieldName extends string = string,
    Arguments extends string = string,
    Condition extends string = string,
> {
    key: Key;
    value: Value;
    optional: Optional;
    uses: Uses;
    field: FieldName;
    arguments: Arguments;
    condition: Condition;
}

interface SelectionUse<Uses = never> {
    uses: Uses;
}

export interface SelectionSuccess<Fields, Uses = never> {
    fields: Fields;
    uses: Uses;
}

type SchemaType<
    S extends GraphQLSchema,
    C extends TypeContext,
> = C["namespace"] extends keyof S["schemas"]
    ? C["name"] extends keyof S["schemas"][C["namespace"]]
        ? S["schemas"][C["namespace"]][C["name"]]
        : never
    : never;

type ScalarField<
    S extends GraphQLSchema,
    C extends TypeContext,
    Name extends string,
> = Name extends "__typename"
    ? PossibleRuntimeTypes<S, C>
    : SchemaType<S, C> extends infer Row
        ? Name extends keyof Row ? Row[Name] : never
        : never;

type RelationsFor<
    S extends GraphQLSchema,
    C extends TypeContext,
> = S extends {
    relations: infer Relations;
}
    ? C["namespace"] extends keyof Relations
        ? C["name"] extends keyof Relations[C["namespace"]]
            ? Relations[C["namespace"]][C["name"]]
            : {}
        : {}
    : {};

type RelationField<
    S extends GraphQLSchema,
    C extends TypeContext,
    Name extends string,
> = RelationsFor<S, C> extends infer Relations
    ? Name extends keyof Relations
        ? Relations[Name] extends GraphQLRelation ? Relations[Name] : never
        : never
    : never;

type ArgumentsFor<
    S extends GraphQLSchema,
    C extends TypeContext,
    Name extends string,
> = S extends { arguments: infer Arguments }
    ? C["namespace"] extends keyof Arguments
        ? C["name"] extends keyof Arguments[C["namespace"]]
            ? Name extends keyof Arguments[C["namespace"]][C["name"]]
                ? Arguments[C["namespace"]][C["name"]][Name]
                : {}
            : {}
        : {}
    : {};

type ResolveType<
    Ref extends string,
    CurrentNamespace extends string,
> = Ref extends `${infer Namespace}.${infer Name}`
    ? TypeContext<Namespace, Name>
    : TypeContext<CurrentNamespace, Ref>;

type HasType<S extends GraphQLSchema, C extends TypeContext> =
    [SchemaType<S, C>] extends [never]
        ? [AbstractPossibleTypes<S, C>] extends [never] ? false : true
        : true;

type AbstractMeta<
    S extends GraphQLSchema,
    C extends TypeContext,
    Key extends "interfaces" | "unions",
> = S extends Record<Key, infer Abstracts>
    ? C["namespace"] extends keyof Abstracts
        ? C["name"] extends keyof Abstracts[C["namespace"]]
            ? Abstracts[C["namespace"]][C["name"]]
            : C["name"] extends keyof Abstracts ? Abstracts[C["name"]] : never
        : C["name"] extends keyof Abstracts ? Abstracts[C["name"]]
        : never
    : never;

type PossibleTypesFromMeta<Meta> =
    Meta extends GraphQLAbstractType<infer Possible> ? Possible
    : Meta extends { possibleTypes: infer Possible extends string } ? Possible
    : Meta extends string ? Meta
    : never;

type AbstractPossibleTypes<
    S extends GraphQLSchema,
    C extends TypeContext,
> =
    | PossibleTypesFromMeta<AbstractMeta<S, C, "interfaces">>
    | PossibleTypesFromMeta<AbstractMeta<S, C, "unions">>;

type PossibleRuntimeTypes<
    S extends GraphQLSchema,
    C extends TypeContext,
> = [AbstractPossibleTypes<S, C>] extends [never]
    ? C["name"]
    : AbstractPossibleTypes<S, C>;

interface FieldHead<
    Alias extends string | undefined,
    Name extends string,
    Rest extends string,
> {
    alias: Alias;
    name: Name;
    rest: Rest;
}

type TakeFieldHead<S extends string> =
    TakeName<S> extends Match<
        infer First extends string,
        infer AfterFirst extends string
    >
        ? SkipIgnored<AfterFirst> extends `:${infer AfterColon}`
            ? TakeName<AfterColon> extends Match<
                infer Name extends string,
                infer Rest extends string
            >
                ? FieldHead<First, Name, Rest>
                : TakeName<AfterColon>
            : FieldHead<undefined, First, AfterFirst>
        : TakeName<S>;

interface FieldTail<
    Rest extends string,
    Arguments extends string,
    Optional extends boolean,
    DirectiveUses,
> {
    rest: Rest;
    arguments: Arguments;
    optional: Optional;
    directiveUses: DirectiveUses;
}

type TakeFieldTail<
    Source extends string,
    S extends GraphQLSchema,
    Namespace extends string,
    Arguments extends string = "",
> =
    SkipIgnored<Source> extends `(${string}`
        ? TakeParenthesized<Source> extends Match<
            infer Args extends string,
            infer Rest extends string
        >
            ? SkipIgnored<Args> extends ""
                ? GraphQLError<"SYNTAX_ERROR", "argument list cannot be empty">
                : TakeDirectives<Rest, S, "FIELD", Namespace> extends DirectivesResult<
                infer After extends string,
                infer Optional extends boolean,
                infer DirectiveUses
            > ? FieldTail<After, Args, Optional, DirectiveUses>
            : TakeDirectives<Rest, S, "FIELD", Namespace>
        : TakeParenthesized<Source>
        : TakeDirectives<Source, S, "FIELD", Namespace> extends DirectivesResult<
            infer Rest extends string,
            infer Optional extends boolean,
            infer DirectiveUses
        > ? FieldTail<Rest, Arguments, Optional, DirectiveUses>
        : TakeDirectives<Source, S, "FIELD", Namespace>;

type WrapRelation<Value, Relation extends GraphQLRelation> =
    Relation["multiple"] extends true
        ? Relation["nullable"] extends true
            ? (Relation["itemNullable"] extends true ? (Value | null)[] : Value[]) | null
            : Relation["itemNullable"] extends true ? (Value | null)[] : Value[]
        : Relation["nullable"] extends true ? Value | null : Value;

type FieldKey<Alias extends string | undefined, Name extends string> =
    Alias extends string ? Alias : Name;

type SameType<A, B> =
    [A] extends [B] ? ([B] extends [A] ? true : false) : false;

// Object-field results carry their raw nested field union instead of an
// eagerly materialized shape, so duplicate selections of the same field can
// merge their sub-selections (spec §5.3.2) at materialization time.
interface ObjectFieldValue<
    Fields = unknown,
    Relation extends GraphQLRelation = GraphQLRelation,
> {
    __objectFieldValue: true;
    fields: Fields;
    relation: Relation;
}

// Spec §5.3.2 SameResponseShape: fields merged under mutually exclusive type
// conditions may keep different names and arguments, but their response
// shapes must still match — identical leaf types, identical list/null
// wrapping, and recursively shape-compatible nested selections paired by
// response key. WrapRelation over a marker type fingerprints the wrapping.
type SameResponseShape<
    Left,
    Right,
    Key extends string,
    Depth extends unknown[],
> = Depth["length"] extends 16
    ? GraphQLError<
        "QUERY_TOO_COMPLEX",
        "field merge nesting exceeds compiler depth budget"
    >
    : [Left] extends [
        ObjectFieldValue<
            infer LeftFields,
            infer LeftRelation extends GraphQLRelation
        >,
    ]
        ? [Right] extends [
            ObjectFieldValue<
                infer RightFields,
                infer RightRelation extends GraphQLRelation
            >,
        ]
            ? SameType<
                WrapRelation<0, LeftRelation>,
                WrapRelation<0, RightRelation>
            > extends true
                ? NestedResponseShapes<LeftFields, RightFields, Depth>
                : GraphQLError<"FIELD_CONFLICT", `conflicting field: ${Key}`>
            : GraphQLError<"FIELD_CONFLICT", `conflicting field: ${Key}`>
        : [Right] extends [ObjectFieldValue<unknown, GraphQLRelation>]
            ? GraphQLError<"FIELD_CONFLICT", `conflicting field: ${Key}`>
        : SameType<Left, Right> extends true ? never
        : GraphQLError<"FIELD_CONFLICT", `conflicting field: ${Key}`>;

type NestedResponseShapes<LeftFields, RightFields, Depth extends unknown[]> =
    LeftFields extends FieldResult<
        infer NestedKey,
        infer Value,
        boolean,
        unknown,
        string,
        string,
        string
    >
        ? RightFields extends FieldResult<
            NestedKey,
            infer OtherValue,
            boolean,
            unknown,
            string,
            string,
            string
        >
            ? SameResponseShape<Value, OtherValue, NestedKey, [unknown, ...Depth]>
            : never
        : never;

// Same response key with an overlapping type condition: per spec §5.3.2 the
// two selections must merge, so a differing sub-selection recurses into a
// conflict check of the combined nested fields instead of being an error.
type FieldConflict<Left, Right, Depth extends unknown[] = []> =
    Left extends FieldResult<
        infer Key,
        infer Value,
        boolean,
        unknown,
        infer FieldName,
        infer Args,
        infer Condition
    >
        ? Right extends FieldResult<
            Key,
            infer OtherValue,
            boolean,
            unknown,
            infer OtherFieldName,
            infer OtherArgs,
            infer OtherCondition
        >
            ? [Extract<Condition, OtherCondition>] extends [never]
                ? SameType<Value, OtherValue> extends true ? never
                : SameResponseShape<Value, OtherValue, Key, [unknown, ...Depth]>
            : SameType<FieldName, OtherFieldName> extends true
                ? SameArguments<Args, OtherArgs> extends true
                    ? SameType<Value, OtherValue> extends true ? never
                    : Value extends ObjectFieldValue<infer LeftFields, GraphQLRelation>
                        ? OtherValue extends ObjectFieldValue<
                            infer RightFields,
                            GraphQLRelation
                        >
                            ? FieldConflicts<
                                LeftFields | RightFields,
                                LeftFields | RightFields,
                                [unknown, ...Depth]
                            >
                            : GraphQLError<"FIELD_CONFLICT", `conflicting field: ${Key}`>
                        : GraphQLError<"FIELD_CONFLICT", `conflicting field: ${Key}`>
                : GraphQLError<"FIELD_CONFLICT", `conflicting field: ${Key}`>
                : GraphQLError<"FIELD_CONFLICT", `conflicting field: ${Key}`>
            : never
        : never;

type FieldConflicts<Fields, All = Fields, Depth extends unknown[] = []> =
    Depth["length"] extends 16
        ? GraphQLError<
            "QUERY_TOO_COMPLEX",
            "field merge nesting exceeds compiler depth budget"
        >
        : Fields extends unknown ? FieldConflict<Fields, All, Depth>
        : never;

type FragmentApplies<
    S extends GraphQLSchema,
    Current extends TypeContext,
    Target extends TypeContext,
> = SameType<Current["namespace"], Target["namespace"]> extends true
    ? [Extract<PossibleRuntimeTypes<S, Current>, PossibleRuntimeTypes<S, Target>>] extends [never]
        ? false
        : true
    : false;

type FragmentIsConditional<
    S extends GraphQLSchema,
    Current extends TypeContext,
    Target extends TypeContext,
> = [PossibleRuntimeTypes<S, Current>] extends [PossibleRuntimeTypes<S, Target>]
    ? false
    : true;

type OptionalIf<
    Fields,
    Left extends boolean,
    Right extends boolean,
> = ApplyOptional<Fields, Left extends true ? true : Right>;

type ApplyOptional<Fields, Optional extends boolean> =
    Optional extends true
        ? Fields extends FieldResult<
            infer Key,
            infer Value,
            boolean,
            infer Uses,
            infer FieldName,
            infer Args,
            infer Condition
        >
            ? FieldResult<Key, Value, true, Uses, FieldName, Args, Condition>
            : Fields
        : Fields;

type CompileField<
    Head extends FieldHead<string | undefined, string, string>,
    S extends GraphQLSchema,
    C extends TypeContext,
    Fragments,
    Fields,
    Visited extends string,
    Steps extends unknown[],
    Depth extends unknown[],
> = TakeFieldTail<Head["rest"], S, C["namespace"]> extends infer Tail
    ? Tail extends FieldTail<
        infer Rest extends string,
        infer ArgumentSource extends string,
        infer Optional extends boolean,
        infer DirectiveUses
    >
        ? ValidateArguments<
            ArgumentSource,
            ArgumentsFor<S, C, Head["name"]>,
            S,
            C["namespace"]
        > extends infer ArgumentResult
            ? ArgumentResult extends GraphQLError ? ArgumentResult
            : ArgumentUses<ArgumentResult> extends infer Uses
            ? RelationField<S, C, Head["name"]> extends infer Relation
            ? [Relation] extends [never]
                ? ScalarField<S, C, Head["name"]> extends infer Scalar
                    ? [Scalar] extends [never]
                        ? GraphQLError<
                            "UNKNOWN_FIELD",
                            `unknown field ${C["name"]}.${Head["name"]}`
                        >
                        : SkipIgnored<Rest> extends `{${string}`
                            ? GraphQLError<
                                "UNEXPECTED_SELECTION",
                                `scalar field ${Head["name"]} cannot have a selection`
                            >
                            : CompileSelectionWorker<
                                Rest,
                                S,
                                C,
                                Fragments,
                                Fields | FieldResult<
                                    FieldKey<Head["alias"], Head["name"]>,
                                    Scalar,
                                    Optional,
                                    Uses | DirectiveUses,
                                    Head["name"],
                                    ArgumentSource,
                                    PossibleRuntimeTypes<S, C>
                                >,
                                Visited,
                                [unknown, ...Steps],
                                Depth
                            >
                    : never
                : Relation extends GraphQLRelation<infer Ref>
                    ? SkipIgnored<Rest> extends `{${string}`
                        ? TakeBraced<Rest> extends Match<
                            infer Nested extends string,
                            infer After extends string
                        >
                            ? ResolveType<Ref, C["namespace"]> extends infer Target extends TypeContext
                                ? HasType<S, Target> extends true
                                    ? RunSelection<
                                        Nested,
                                        S,
                                        Target,
                                        Fragments,
                                        never,
                                        Visited,
                                        [unknown, ...Depth]
                                    > extends infer NestedResult
                                        ? NestedResult extends SelectionSuccess<
                                            infer NestedFields,
                                            infer NestedUses
                                        >
                                            ? CompileSelectionWorker<
                                                After,
                                                S,
                                                C,
                                                Fragments,
                                                Fields | FieldResult<
                                                    FieldKey<Head["alias"], Head["name"]>,
                                                    ObjectFieldValue<NestedFields, Relation>,
                                                    Optional,
                                                    Uses | DirectiveUses | NestedUses,
                                                    Head["name"],
                                                    ArgumentSource,
                                                    PossibleRuntimeTypes<S, C>
                                                >,
                                                Visited,
                                                [unknown, ...Steps],
                                                Depth
                                            >
                                            : NestedResult
                                        : never
                                    : GraphQLError<
                                        "UNKNOWN_TYPE",
                                        `unknown relation target: ${Ref}`
                                    >
                                : never
                            : TakeBraced<Rest>
                        : GraphQLError<
                            "MISSING_SELECTION",
                            `object field ${Head["name"]} requires a selection`
                        >
                    : never
            : never
            : never
            : never
        : Tail
    : never;

type CompileNamedFragment<
    Name extends string,
    Rest extends string,
    S extends GraphQLSchema,
    C extends TypeContext,
    Fragments,
    Fields,
    Visited extends string,
    Steps extends unknown[],
    Depth extends unknown[],
    Optional extends boolean,
    DirectiveUses,
> = Name extends Visited
    ? GraphQLError<"FRAGMENT_CYCLE", `fragment cycle at ${Name}`>
    : Extract<Fragments, { name: Name }> extends infer Fragment
        ? [Fragment] extends [never]
            ? GraphQLError<"UNKNOWN_FRAGMENT", `unknown fragment: ${Name}`>
            : Fragment extends FragmentEntry<
                Name,
                infer On extends string,
                infer Selection extends string,
                infer FragmentDirectiveUses
            >
                ? ResolveType<On, C["namespace"]> extends infer Target extends TypeContext
                    ? HasType<S, Target> extends true
                        ? FragmentApplies<S, C, Target> extends true
                            ? RunSelection<
                                Selection,
                                S,
                                Target,
                                Fragments,
                                never,
                                Visited | Name,
                                [unknown, ...Depth]
                            > extends infer FragmentResult
                                ? FragmentResult extends SelectionSuccess<
                                    infer FragmentFields,
                                    infer FragmentUses
                                >
                                    ? CompileSelectionWorker<
                                        Rest,
                                        S,
                                        C,
                                        Fragments,
                                        | Fields
                                        | OptionalIf<
                                            FragmentFields,
                                            Optional,
                                            FragmentIsConditional<S, C, Target>
                                        >
                                        | SelectionUse<
                                            | DirectiveUses
                                            | FragmentDirectiveUses
                                            | FragmentUses
                                        >,
                                        Visited,
                                        [unknown, ...Steps],
                                        Depth
                                    >
                                    : FragmentResult
                                : never
                            : GraphQLError<
                                "FRAGMENT_TYPE_MISMATCH",
                                `fragment ${Name} cannot apply to ${C["name"]}`
                            >
                        : GraphQLError<"UNKNOWN_TYPE", `unknown fragment type: ${On}`>
                    : never
                : never
        : never;

type CompileInlineBody<
    Source extends string,
    S extends GraphQLSchema,
    C extends TypeContext,
    Target extends TypeContext,
    Fragments,
    Fields,
    Visited extends string,
    Steps extends unknown[],
    Depth extends unknown[],
> = TakeDirectives<Source, S, "INLINE_FRAGMENT", C["namespace"]> extends DirectivesResult<
    infer BeforeSelection extends string,
    infer Optional extends boolean,
    infer DirectiveUses
>
    ? TakeBraced<BeforeSelection> extends Match<
        infer Selection extends string,
        infer After extends string
    >
        ? RunSelection<
            Selection,
            S,
            Target,
            Fragments,
            never,
            Visited,
            [unknown, ...Depth]
        > extends infer InlineResult
            ? InlineResult extends SelectionSuccess<
                infer InlineFields,
                infer InlineUses
            >
                ? CompileSelectionWorker<
                    After,
                    S,
                    C,
                    Fragments,
                    | Fields
                    | OptionalIf<
                        InlineFields,
                        Optional,
                        FragmentIsConditional<S, C, Target>
                    >
                    | SelectionUse<DirectiveUses | InlineUses>,
                    Visited,
                    [unknown, ...Steps],
                    Depth
                >
                : InlineResult
            : never
        : TakeBraced<BeforeSelection>
    : TakeDirectives<Source, S, "INLINE_FRAGMENT", C["namespace"]>;

type CompileSpread<
    S0 extends string,
    S extends GraphQLSchema,
    C extends TypeContext,
    Fragments,
    Fields,
    Visited extends string,
    Steps extends unknown[],
    Depth extends unknown[],
> = SkipIgnored<S0> extends `${"@" | "{"}${string}`
    ? CompileInlineBody<S0, S, C, C, Fragments, Fields, Visited, Steps, Depth>
    : TakeName<S0> extends Match<
        infer Name extends string,
        infer Rest extends string
    >
    ? Name extends "on"
        ? TakeName<Rest> extends Match<
            infer On extends string,
            infer AfterOn extends string
        >
            ? ResolveType<On, C["namespace"]> extends infer Target extends TypeContext
                ? HasType<S, Target> extends true
                    ? FragmentApplies<S, C, Target> extends true
                        ? CompileInlineBody<
                            AfterOn,
                            S,
                            C,
                            Target,
                            Fragments,
                            Fields,
                            Visited,
                            Steps,
                            Depth
                        >
                        : GraphQLError<
                            "FRAGMENT_TYPE_MISMATCH",
                            `inline fragment cannot apply to ${C["name"]}`
                        >
                    : GraphQLError<"UNKNOWN_TYPE", `unknown inline fragment type: ${On}`>
                : never
            : TakeName<Rest>
        : TakeDirectives<Rest, S, "FRAGMENT_SPREAD", C["namespace"]> extends DirectivesResult<
            infer AfterDirectives extends string,
            infer Optional extends boolean,
            infer DirectiveUses
        >
            ? CompileNamedFragment<
                Name,
                AfterDirectives,
                S,
                C,
                Fragments,
                Fields,
                Visited,
                Steps,
                Depth,
                Optional,
                DirectiveUses
            >
            : TakeDirectives<Rest, S, "FRAGMENT_SPREAD", C["namespace"]>
    : TakeName<S0>;

type CompileSelectionWorker<
    Source extends string,
    S extends GraphQLSchema,
    C extends TypeContext,
    Fragments,
    Fields = never,
    Visited extends string = never,
    Steps extends unknown[] = [],
    Depth extends unknown[] = [],
> = Steps["length"] extends 100
    ? SelectionChunk<Source, S, C, Fragments, Fields, Visited, Depth>
    : SkipIgnored<Source> extends infer Rest extends string
        ? Rest extends ""
            ? [Fields] extends [never]
                ? GraphQLError<"SYNTAX_ERROR", "selection set cannot be empty">
                : FieldConflicts<Fields> extends infer Conflicts
                    ? [Conflicts] extends [never]
                        ? SelectionSuccess<Fields, FieldUses<Fields>>
                        : Conflicts
                    : never
        : Rest extends `...${infer AfterSpread}`
            ? CompileSpread<AfterSpread, S, C, Fragments, Fields, Visited, Steps, Depth>
            : TakeFieldHead<Rest> extends infer Head
                ? Head extends FieldHead<string | undefined, string, string>
                    ? CompileField<Head, S, C, Fragments, Fields, Visited, Steps, Depth>
                    : Head
                : never
        : never;

interface SelectionChunk<
    Source extends string,
    S extends GraphQLSchema,
    C extends TypeContext,
    Fragments,
    Fields,
    Visited extends string,
    Depth extends unknown[],
> {
    __selectionChunk: [Source, S, C, Fragments, Fields, Visited, Depth];
}

type DriveSelection<R, Chunks extends unknown[] = []> =
    Chunks["length"] extends 64
        ? GraphQLError<"QUERY_TOO_COMPLEX", "selection exceeds compiler budget">
        : R extends SelectionChunk<
            infer Source,
            infer S,
            infer C,
            infer Fragments,
            infer Fields,
            infer Visited,
            infer Depth
        >
            ? DriveSelection<
                CompileSelectionWorker<
                    Source,
                    S,
                    C,
                    Fragments,
                    Fields,
                    Visited,
                    [],
                    Depth
                >,
                [unknown, ...Chunks]
            >
            : R;

// Cross-level depth guard (fields, named fragments, inline fragments all
// re-enter here). Without it, deep nesting overflowed tsc's instantiation
// stack at ~43 levels — a TS2589 that silently widens IsValidGraphQL and
// GetReturnType to `any` instead of failing.
type RunSelection<
    Source extends string,
    S extends GraphQLSchema,
    C extends TypeContext,
    Fragments,
    Fields = never,
    Visited extends string = never,
    Depth extends unknown[] = [],
> = Depth["length"] extends 32
    ? GraphQLError<
        "QUERY_TOO_COMPLEX",
        "selection nesting exceeds compiler depth budget"
    >
    : DriveSelection<
        CompileSelectionWorker<Source, S, C, Fragments, Fields, Visited, [], Depth>
    >;

type FieldKeys<Fields> =
    Fields extends FieldResult<infer Key, unknown, boolean, unknown> ? Key : never;

// All carriers for the same response key and the same type condition merge
// into one object shape (spec §5.3.2 CollectFields); occurrences under
// different conditions stay separate union members.
type MergedNestedFields<All, Key extends string, Condition> =
    All extends FieldResult<
        Key,
        infer Value,
        boolean,
        unknown,
        string,
        string,
        infer OtherCondition
    >
        ? SameType<Condition, OtherCondition> extends true
            ? Value extends ObjectFieldValue<infer Nested, GraphQLRelation>
                ? Nested
                : never
            : never
        : never;

type FieldValue<Fields, Key extends string, All = Fields> =
    Fields extends FieldResult<
        Key,
        infer Value,
        boolean,
        unknown,
        string,
        string,
        infer Condition
    >
        ? Value extends ObjectFieldValue<unknown, infer Relation>
            ? WrapRelation<
                MaterializeFields<MergedNestedFields<All, Key, Condition>>,
                Relation
            >
            : Value
        : never;

type FieldUses<Fields> =
    Fields extends FieldResult<string, unknown, boolean, infer Uses> ? Uses
    : Fields extends SelectionUse<infer Uses> ? Uses
    : never;

type OptionalFlag<Fields, Key extends string> =
    Extract<Fields, { key: Key }> extends infer Matches
        ? Matches extends { optional: infer Optional extends boolean } ? Optional
        : never
        : never;

// A response key is guaranteed present when ANY of its occurrences is
// unconditional (optional: false) — an @include/@skip or narrower type
// condition on one duplicate cannot remove a field another selection
// always produces.
type RequiredKeys<Fields> = {
    [K in FieldKeys<Fields>]:
        false extends OptionalFlag<Fields, K> ? K : never;
}[FieldKeys<Fields>];

type OptionalKeys<Fields> = Exclude<FieldKeys<Fields>, RequiredKeys<Fields>>;

type Simplify<T> = { [K in keyof T]: T[K] };

export type MaterializeFields<Fields> = Simplify<
    & { [K in RequiredKeys<Fields>]: FieldValue<Fields, K>; }
    & { [K in OptionalKeys<Fields>]?: FieldValue<Fields, K>; }
>;

export type CompileSelection<
    Source extends string,
    S extends GraphQLSchema,
    Root extends string,
    Fragments = never,
> = ResolveType<Root, S["defaultSchema"]> extends infer Context extends TypeContext
    ? HasType<S, Context> extends true
        ? RunSelection<Source, S, Context, Fragments> extends infer Result
            ? Result extends SelectionSuccess<infer Fields, infer Uses>
                ? SelectionSuccess<MaterializeFields<Fields>, Uses>
                : Result
            : never
        : GraphQLError<"UNKNOWN_OPERATION_ROOT", `unknown root type: ${Root}`>
    : never;
