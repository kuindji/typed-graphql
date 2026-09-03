import type { GraphQLError } from "../diagnostics.js";
import type { GraphQLInput, GraphQLSchema } from "../schema.js";
import type {
    TakeValue,
    ValidateDefaultValue,
    VariableApplicationType,
    VariableUse,
} from "./arguments.js";
import type { DirectivesResult, TakeDirectives } from "./directives.js";
import type { Match, SkipIgnored, TakeName } from "./scanner.js";

type VariableDefaultState = "none" | "null" | "value";

interface VariableDefinition<
    Name extends string = string,
    Wire extends string = string,
    Default extends VariableDefaultState = VariableDefaultState,
> {
    name: Name;
    wire: Wire;
    default: Default;
}

interface VariablesSuccess<Definitions, Uses = never> {
    definitions: Definitions;
    uses: Uses;
}

type DefaultState<Value> = Value extends { kind: "null"; } ? "null" : "value";

type TakeTypeReference<S extends string> = SkipIgnored<S> extends
    `[${infer Rest}` ? TakeTypeReference<Rest> extends Match<
        infer Inner extends string,
        infer AfterInner extends string
    >
        ? SkipIgnored<AfterInner> extends `]${infer AfterClose}`
            ? SkipIgnored<AfterClose> extends `!${infer AfterBang}`
                ? Match<`[${Inner}]!`, AfterBang>
            : Match<`[${Inner}]`, AfterClose>
        : GraphQLError<"SYNTAX_ERROR", "expected ] in variable type">
    : TakeTypeReference<Rest>
    : TakeName<S> extends Match<
        infer Name extends string,
        infer Rest extends string
    >
        ? SkipIgnored<Rest> extends `!${infer AfterBang}`
            ? Match<`${Name}!`, AfterBang>
        : Match<Name, Rest>
    : TakeName<S>;

// Directives on a variable definition are Directives[Const] (spec §5.8):
// their arguments cannot reference variables. Shared tail for the
// default/no-default branches of ParseVariableDefinitions.
type ContinueVariableDefinitions<
    After extends string,
    Schema,
    Namespace extends string,
    Definitions,
    Uses,
    Steps extends unknown[],
> = Schema extends GraphQLSchema ? TakeDirectives<
        After,
        Schema,
        "VARIABLE_DEFINITION",
        Namespace
    > extends infer Directives ? Directives extends DirectivesResult<
            infer AfterDirectives extends string,
            boolean,
            infer DirectiveUses
        > ? [ DirectiveUses ] extends [ never ] ? ParseVariableDefinitions<
                    AfterDirectives,
                    Schema,
                    Namespace,
                    Definitions,
                    Uses,
                    [ unknown, ...Steps ]
                >
            : GraphQLError<
                "SYNTAX_ERROR",
                "variable definition directive arguments must be constant"
            >
        : Directives
    : never
    : ParseVariableDefinitions<
        After,
        Schema,
        Namespace,
        Definitions,
        Uses,
        [ unknown, ...Steps ]
    >;

type ParseVariableDefinitions<
    S extends string,
    Schema = never,
    Namespace extends string = string,
    Definitions = never,
    Uses = never,
    Steps extends unknown[] = [],
> = Steps["length"] extends 64
    ? GraphQLError<"QUERY_TOO_COMPLEX", "operation has too many variables">
    : SkipIgnored<S> extends infer Rest extends string
        ? Rest extends "" ? VariablesSuccess<Definitions, Uses>
        : Rest extends `$${infer AfterDollar}`
            ? TakeName<AfterDollar> extends Match<
                infer Name extends string,
                infer AfterName extends string
            >
                ? Extract<Definitions, { name: Name; }> extends never
                    ? SkipIgnored<AfterName> extends `:${infer AfterColon}`
                        ? TakeTypeReference<AfterColon> extends Match<
                            infer Wire extends string,
                            infer AfterType extends string
                        >
                            ? SkipIgnored<AfterType> extends
                                `=${infer AfterEqual}`
                                ? TakeValue<AfterEqual> extends Match<
                                    infer DefaultValue,
                                    infer AfterDefault extends string
                                > ? ValidateDefaultValue<
                                        DefaultValue,
                                        Wire,
                                        Schema,
                                        Namespace
                                    > extends infer DefaultValidation
                                        ? DefaultValidation extends GraphQLError
                                            ? DefaultValidation
                                        : ContinueVariableDefinitions<
                                            AfterDefault,
                                            Schema,
                                            Namespace,
                                            | Definitions
                                            | VariableDefinition<
                                                Name,
                                                Wire,
                                                DefaultState<DefaultValue>
                                            >,
                                            Uses,
                                            Steps
                                        >
                                    : never
                                : TakeValue<AfterEqual>
                            : ContinueVariableDefinitions<
                                AfterType,
                                Schema,
                                Namespace,
                                Definitions | VariableDefinition<Name, Wire>,
                                Uses,
                                Steps
                            >
                        : TakeTypeReference<AfterColon>
                    : GraphQLError<"SYNTAX_ERROR", `expected : after $${Name}`>
                : GraphQLError<
                    "DUPLICATE_VARIABLE",
                    `duplicate variable: ${Name}`
                >
            : TakeName<AfterDollar>
        : GraphQLError<"SYNTAX_ERROR", "expected variable definition">
    : never;

// Spec `AreTypesCompatible` (§5.8.5): non-null variables can flow into
// nullable locations, recursing into list item types.
type TypeCompatible<
    Declared extends string,
    Expected extends string,
> = Expected extends `${infer ExpectedBase}!`
    ? Declared extends `${infer DeclaredBase}!`
        ? TypeCompatible<DeclaredBase, ExpectedBase>
    : false
    : Declared extends `${infer DeclaredBase}!`
        ? TypeCompatible<DeclaredBase, Expected>
    : Expected extends `[${infer ExpectedItem}]`
        ? Declared extends `[${infer DeclaredItem}]`
            ? TypeCompatible<DeclaredItem, ExpectedItem>
        : false
    : Declared extends `[${string}]` ? false
    : Declared extends Expected ? true
    : false;

type WireCompatible<
    Declared extends string,
    Expected extends string,
    Default extends VariableDefaultState,
> = TypeCompatible<Declared, Expected> extends true ? true
    : Expected extends `${infer ExpectedBase}!`
        ? Default extends "value" ? TypeCompatible<Declared, ExpectedBase>
        : false
    : false;

type UseError<Use, Definitions> = Use extends
    VariableUse<infer Name, infer Input>
    ? Extract<Definitions, { name: Name; }> extends infer Definition
        ? [ Definition ] extends [ never ] ? GraphQLError<
                "UNDECLARED_VARIABLE",
                `undeclared variable: $${Name}`
            >
        : Definition extends VariableDefinition<
            Name,
            infer Wire,
            infer Default
        >
            ? Input extends GraphQLInput<infer ExpectedWire, unknown>
                ? WireCompatible<Wire, ExpectedWire, Default> extends true
                    ? never
                : GraphQLError<
                    "INVALID_VARIABLE_TYPE",
                    `$${Name} (${Wire}) is incompatible with ${ExpectedWire}`
                >
            : GraphQLError<
                "INVALID_SCHEMA",
                "variable use has invalid input metadata"
            >
        : never
    : never
    : never;

type UseErrors<Uses, Definitions> = Uses extends unknown
    ? UseError<Uses, Definitions>
    : never;

type UsedNames<Uses> = Uses extends VariableUse<infer Name, unknown> ? Name
    : never;

type DefinedNames<Definitions> = Definitions extends
    VariableDefinition<infer Name, string, VariableDefaultState> ? Name : never;

type UnusedNames<Definitions, Uses> = Exclude<
    DefinedNames<Definitions>,
    UsedNames<Uses>
>;

// A variable carries one runtime value that flows into every argument position
// it is used at, so its value type must satisfy all of them — the intersection
// of the per-use application types, not their union (e.g. a value used where
// both `UserId` and `PostId` are expected is `UserId & PostId`, not
// `UserId | PostId`, which would let a `UserId` leak into the `PostId` slot).
// Distribution happens per use inside a contravariant function-parameter
// position, so a union that lives *within* a single use's application type
// (an enum-like `"a" | "b"`) is preserved rather than collapsed to `never`.
type VariableValue<Uses, Name extends string> =
    (Extract<Uses, { name: Name; }> extends infer Use
        ? Use extends VariableUse<Name>
            ? (arg: VariableApplicationType<Use>) => void
        : never
        : never) extends (arg: infer Value) => void ? Value
        : never;

type RequiredVariableNames<Uses, Definitions> = {
    [Name in UsedNames<Uses>]: Extract<Definitions, { name: Name; }> extends
        VariableDefinition<
            Name,
            infer Wire,
            infer Default
        > ? Wire extends `${string}!` ? Default extends "none" ? Name : never
        : never
        : never;
}[UsedNames<Uses>];

type OptionalVariableNames<Uses, Definitions> = Exclude<
    UsedNames<Uses>,
    RequiredVariableNames<Uses, Definitions>
>;

// True when any use of the variable sits at a non-null argument position.
// A nullable variable only reaches such a position through its non-null
// default (spec §5.8.5), and an explicit null there is a field error at
// execution time (§6.4.1) — the default does not substitute for null.
type UsedAtNonNull<Uses, Name extends string> = Uses extends
    VariableUse<Name, GraphQLInput<infer ExpectedWire, unknown>>
    ? ExpectedWire extends `${string}!` ? true : false
    : never;

// A nullable wire type accepts an explicit null value, so the runtime
// variables object widens to `| null` for it — unless one of its uses is a
// non-null argument. A variable that is optional only because it carries a
// default on a non-null type must not widen either.
type NullIfNullable<Definitions, Uses, Name extends string> =
    Extract<Definitions, { name: Name; }> extends VariableDefinition<
        Name,
        infer Wire,
        VariableDefaultState
    > ? Wire extends `${string}!` ? never
        : true extends UsedAtNonNull<Uses, Name> ? never
        : null
        : never;

type Simplify<T> = { [K in keyof T]: T[K]; };

type MaterializeVariables<Uses, Definitions> = Simplify<
    & {
        [Name in RequiredVariableNames<Uses, Definitions>]: VariableValue<
            Uses,
            Name
        >;
    }
    & {
        [Name in OptionalVariableNames<Uses, Definitions>]?:
            | VariableValue<Uses, Name>
            | NullIfNullable<Definitions, Uses, Name>;
    }
>;

export type ResolveVariables<
    Source extends string | undefined,
    Uses,
    S = never,
    Namespace extends string = string,
> = Source extends undefined ? [ Uses ] extends [ never ] ? {} : GraphQLError<
        "UNDECLARED_VARIABLE",
        "operation uses variables but declares none"
    >
    : Source extends string ? SkipIgnored<Source> extends "" ? GraphQLError<
                "SYNTAX_ERROR",
                "variable definition list cannot be empty"
            >
        : ParseVariableDefinitions<Source, S, Namespace> extends infer Parsed
            ? Parsed extends GraphQLError ? Parsed
            : Parsed extends VariablesSuccess<
                infer Definitions,
                infer DefinitionDirectiveUses
            >
                ? UseErrors<Uses | DefinitionDirectiveUses, Definitions> extends
                    infer Errors ? [ Errors ] extends [ never ] ? UnusedNames<
                            Definitions,
                            Uses | DefinitionDirectiveUses
                        > extends infer Unused
                            ? [ Unused ] extends [ never ]
                                ? MaterializeVariables<
                                    Uses | DefinitionDirectiveUses,
                                    Definitions
                                >
                            : GraphQLError<
                                "UNUSED_VARIABLE",
                                `unused variable: $${Unused & string}`
                            >
                        : never
                    : Errors
                : never
            : GraphQLError<
                "SYNTAX_ERROR",
                "could not parse variable definitions"
            >
        : never
    : never;
