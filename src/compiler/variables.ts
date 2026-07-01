import type { GraphQLError } from "../diagnostics.js";
import type { GraphQLInput, GraphQLSchema } from "../schema.js";
import type { TakeValue, VariableApplicationType, VariableUse } from "./arguments.js";
import type { DirectivesResult, TakeDirectives } from "./directives.js";
import type {
    Match,
    SkipIgnored,
    TakeName,
} from "./scanner.js";

interface VariableDefinition<
    Name extends string = string,
    Wire extends string = string,
    HasDefault extends boolean = boolean,
> {
    name: Name;
    wire: Wire;
    hasDefault: HasDefault;
}

interface VariablesSuccess<Definitions, Uses = never> {
    definitions: Definitions;
    uses: Uses;
}

type TakeTypeReference<S extends string> =
    SkipIgnored<S> extends `[${infer Rest}`
        ? TakeTypeReference<Rest> extends Match<
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
                ? Extract<Definitions, { name: Name }> extends never
                    ? SkipIgnored<AfterName> extends `:${infer AfterColon}`
                        ? TakeTypeReference<AfterColon> extends Match<
                            infer Wire extends string,
                            infer AfterType extends string
                        >
                            ? SkipIgnored<AfterType> extends `=${infer AfterEqual}`
                                ? TakeValue<AfterEqual> extends Match<
                                    unknown,
                                    infer AfterDefault extends string
                                >
                                    ? Schema extends GraphQLSchema
                                        ? TakeDirectives<
                                            AfterDefault,
                                            Schema,
                                            "VARIABLE_DEFINITION",
                                            Namespace
                                        > extends DirectivesResult<
                                            infer AfterDirectives extends string,
                                            boolean,
                                            infer DirectiveUses
                                        >
                                        ? ParseVariableDefinitions<
                                            AfterDirectives,
                                            Schema,
                                            Namespace,
                                            Definitions | VariableDefinition<Name, Wire, true>,
                                            Uses | DirectiveUses,
                                            [unknown, ...Steps]
                                        >
                                        : TakeDirectives<
                                            AfterDefault,
                                            Schema,
                                            "VARIABLE_DEFINITION",
                                            Namespace
                                        >
                                        : ParseVariableDefinitions<
                                            AfterDefault,
                                            Schema,
                                            Namespace,
                                            Definitions | VariableDefinition<Name, Wire, true>,
                                            Uses,
                                            [unknown, ...Steps]
                                        >
                                    : TakeValue<AfterEqual>
                                : Schema extends GraphQLSchema
                                    ? TakeDirectives<
                                        AfterType,
                                        Schema,
                                        "VARIABLE_DEFINITION",
                                        Namespace
                                    > extends DirectivesResult<
                                        infer AfterDirectives extends string,
                                        boolean,
                                        infer DirectiveUses
                                    >
                                    ? ParseVariableDefinitions<
                                        AfterDirectives,
                                        Schema,
                                        Namespace,
                                        Definitions | VariableDefinition<Name, Wire, false>,
                                        Uses | DirectiveUses,
                                        [unknown, ...Steps]
                                    >
                                    : TakeDirectives<
                                        AfterType,
                                        Schema,
                                        "VARIABLE_DEFINITION",
                                        Namespace
                                    >
                                    : ParseVariableDefinitions<
                                        AfterType,
                                        Schema,
                                        Namespace,
                                        Definitions | VariableDefinition<Name, Wire, false>,
                                        Uses,
                                        [unknown, ...Steps]
                                    >
                            : TakeTypeReference<AfterColon>
                        : GraphQLError<"SYNTAX_ERROR", `expected : after $${Name}`>
                    : GraphQLError<"DUPLICATE_VARIABLE", `duplicate variable: ${Name}`>
                : TakeName<AfterDollar>
            : GraphQLError<"SYNTAX_ERROR", "expected variable definition">
        : never;

type StripNonNull<T extends string> = T extends `${infer Inner}!` ? Inner : T;

type WireCompatible<Declared extends string, Expected extends string> =
    Declared extends Expected ? true
    : Declared extends `${infer DeclaredBase}!`
        ? DeclaredBase extends StripNonNull<Expected> ? true : false
        : false;

type UseError<Use, Definitions> =
    Use extends VariableUse<infer Name, infer Input>
        ? Extract<Definitions, { name: Name }> extends infer Definition
            ? [Definition] extends [never]
                ? GraphQLError<"UNDECLARED_VARIABLE", `undeclared variable: $${Name}`>
                : Definition extends VariableDefinition<Name, infer Wire, boolean>
                    ? Input extends GraphQLInput<infer ExpectedWire, unknown>
                        ? WireCompatible<Wire, ExpectedWire> extends true ? never
                        : GraphQLError<
                            "INVALID_VARIABLE_TYPE",
                            `$${Name} (${Wire}) is incompatible with ${ExpectedWire}`
                        >
                    : GraphQLError<"INVALID_SCHEMA", "variable use has invalid input metadata">
                : never
            : never
        : never;

type UseErrors<Uses, Definitions> =
    Uses extends unknown ? UseError<Uses, Definitions> : never;

type UsedNames<Uses> =
    Uses extends VariableUse<infer Name, unknown> ? Name : never;

type DefinedNames<Definitions> =
    Definitions extends VariableDefinition<infer Name, string, boolean> ? Name : never;

type UnusedNames<Definitions, Uses> =
    Exclude<DefinedNames<Definitions>, UsedNames<Uses>>;

type VariableValue<Uses, Name extends string> =
    VariableApplicationType<Extract<Uses, { name: Name }>>;

type RequiredVariableNames<Uses, Definitions> = {
    [Name in UsedNames<Uses>]:
        Extract<Definitions, { name: Name }> extends VariableDefinition<
            Name,
            infer Wire,
            infer HasDefault
        >
            ? Wire extends `${string}!`
                ? HasDefault extends true ? never : Name
                : never
            : never;
}[UsedNames<Uses>];

type OptionalVariableNames<Uses, Definitions> =
    Exclude<UsedNames<Uses>, RequiredVariableNames<Uses, Definitions>>;

type Simplify<T> = { [K in keyof T]: T[K] };

type MaterializeVariables<Uses, Definitions> = Simplify<{
    [Name in RequiredVariableNames<Uses, Definitions>]: VariableValue<Uses, Name>;
} & {
    [Name in OptionalVariableNames<Uses, Definitions>]?: VariableValue<Uses, Name>;
}>;

export type ResolveVariables<
    Source extends string | undefined,
    Uses,
    S = never,
    Namespace extends string = string,
> =
    Source extends undefined
        ? [Uses] extends [never] ? {} : GraphQLError<
            "UNDECLARED_VARIABLE",
            "operation uses variables but declares none"
        >
        : Source extends string
            ? SkipIgnored<Source> extends ""
                ? GraphQLError<"SYNTAX_ERROR", "variable definition list cannot be empty">
                : ParseVariableDefinitions<Source, S, Namespace> extends infer Parsed
                    ? Parsed extends GraphQLError ? Parsed
                    : Parsed extends VariablesSuccess<infer Definitions, infer DefinitionDirectiveUses>
                        ? UseErrors<Uses | DefinitionDirectiveUses, Definitions> extends infer Errors
                            ? [Errors] extends [never]
                                ? UnusedNames<
                                    Definitions,
                                    Uses | DefinitionDirectiveUses
                                > extends infer Unused
                                    ? [Unused] extends [never]
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
                        : GraphQLError<"SYNTAX_ERROR", "could not parse variable definitions">
                    : never
            : never;
