import type { GraphQLError } from "../diagnostics.js";
import type {
    DefaultInputType,
    GraphQLInput,
    GraphQLSchema,
    InputApplicationType,
} from "../schema.js";
import type {
    Match,
    SkipIgnored,
    TakeBraced,
    TakeBracketed,
    TakeName,
    TakeString,
} from "./scanner.js";

export interface VariableUse<
    Name extends string = string,
    Input = unknown,
> {
    name: Name;
    input: Input;
}

interface ArgumentsSuccess<Uses> {
    uses: Uses;
}

interface VariableValue<Name extends string> {
    kind: "variable";
    name: Name;
}

interface LiteralValue<Kind extends string, Source extends string = string> {
    kind: Kind;
    source: Source;
}

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type NonZeroDigit = Exclude<Digit, "0">;
type NameStart =
    | "_" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
    | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z"
    | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
    | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";

interface NumberScan<Kind extends "int" | "float", Rest extends string> {
    kind: Kind;
    rest: Rest;
}

type SkipDigits<S extends string> =
    S extends `${Digit}${infer Rest}` ? SkipDigits<Rest> : S;

type SkipInteger<S extends string> =
    S extends `0${Digit}${string}` ? never
    : S extends `0${infer Rest}` ? Rest
    : S extends `${NonZeroDigit}${infer Rest}` ? SkipDigits<Rest>
    : never;

type SkipExponent<S extends string> =
    S extends `${"+" | "-"}${infer Rest}`
        ? Rest extends `${Digit}${string}` ? SkipDigits<Rest> : never
    : S extends `${Digit}${string}` ? SkipDigits<S>
    : never;

type ScanFractionExponent<S extends string> =
    S extends `.${infer Fraction}`
        ? Fraction extends `${Digit}${string}`
            ? SkipDigits<Fraction> extends `${"e" | "E"}${infer Exponent}`
                ? SkipExponent<Exponent> extends infer Rest extends string
                    ? NumberScan<"float", Rest>
                    : never
                : NumberScan<"float", SkipDigits<Fraction>>
            : never
    : S extends `${"e" | "E"}${infer Exponent}`
        ? SkipExponent<Exponent> extends infer Rest extends string
            ? NumberScan<"float", Rest>
            : never
        : NumberScan<"int", S>;

type GuardNumberEnd<Scan> =
    Scan extends NumberScan<infer Kind, infer Rest>
        ? Rest extends `${NameStart | Digit | "."}${string}` ? never
        : NumberScan<Kind, Rest>
        : never;

type ScanNumber<S extends string> =
    S extends `-${infer Positive}`
        ? SkipInteger<Positive> extends infer Rest extends string
            ? GuardNumberEnd<ScanFractionExponent<Rest>>
            : never
        : SkipInteger<S> extends infer Rest extends string
            ? GuardNumberEnd<ScanFractionExponent<Rest>>
            : never;

type TakeNumber<S extends string> =
    [ScanNumber<S>] extends [never]
        ? GraphQLError<"SYNTAX_ERROR", "invalid numeric literal">
        : ScanNumber<S> extends NumberScan<infer Kind, infer Rest>
        ? Match<LiteralValue<Kind>, Rest>
        : GraphQLError<"SYNTAX_ERROR", "invalid numeric literal">;

export type TakeValue<S extends string> =
    SkipIgnored<S> extends `$${infer Rest}`
        ? TakeName<Rest> extends Match<
            infer Name extends string,
            infer After extends string
        > ? Match<VariableValue<Name>, After>
        : TakeName<Rest>
    : SkipIgnored<S> extends `"""${string}` | `"${string}`
        ? TakeString<S> extends Match<infer Value extends string, infer Rest extends string>
            ? Match<LiteralValue<"string", Value>, Rest>
            : TakeString<S>
    : SkipIgnored<S> extends `[${string}`
        ? TakeBracketed<S> extends Match<
            infer Body extends string,
            infer Rest extends string
        > ? Match<LiteralValue<"list", Body>, Rest>
        : TakeBracketed<S>
    : SkipIgnored<S> extends `{${string}`
        ? TakeBraced<S> extends Match<
            infer Body extends string,
            infer Rest extends string
        > ? Match<LiteralValue<"object", Body>, Rest>
        : TakeBraced<S>
    : SkipIgnored<S> extends `${infer First}${string}`
        ? First extends Digit | "-"
            ? TakeNumber<SkipIgnored<S>>
            : TakeName<S> extends Match<
                infer Name extends string,
                infer After extends string
            >
                ? Match<
                    LiteralValue<
                        Name extends "true" | "false" ? "boolean"
                        : Name extends "null" ? "null"
                        : "enum",
                        Name
                    >,
                    After
                >
                : TakeName<S>
        : GraphQLError<"UNEXPECTED_TOKEN", "expected argument value">;

type StripNonNull<Wire extends string> =
    Wire extends `${infer Inner}!` ? Inner : Wire;

type InputFields<
    S,
    Namespace extends string,
    Name extends string,
> = S extends GraphQLSchema
    ? S extends { inputs: infer Inputs }
        ? Namespace extends keyof Inputs
            ? Name extends keyof Inputs[Namespace]
                ? Inputs[Namespace][Name]
                : Name extends keyof Inputs ? Inputs[Name] : never
            : Name extends keyof Inputs ? Inputs[Name] : never
        : never
    : never;

type EnumValues<
    S,
    Namespace extends string,
    Name extends string,
> = S extends GraphQLSchema
    ? S extends { enums: infer Enums }
        ? Namespace extends keyof Enums
            ? Name extends keyof Enums[Namespace]
                ? Enums[Namespace][Name]
                : Name extends keyof Enums ? Enums[Name] : never
            : Name extends keyof Enums ? Enums[Name] : never
        : never
    : never;

type BuiltInScalarName = "Int" | "Float" | "Boolean" | "String" | "ID";

type ScalarAppType<
    S,
    Namespace extends string,
    Name extends string,
> = S extends GraphQLSchema
    ? S extends { scalars: infer Scalars }
        ? Namespace extends keyof Scalars
            ? Name extends keyof Scalars[Namespace]
                ? Scalars[Namespace][Name]
                : Name extends keyof Scalars ? Scalars[Name] : never
            : Name extends keyof Scalars ? Scalars[Name] : never
        : never
    : never;

type CustomScalarLiteralCompatible<Value, App> =
    [unknown] extends [App] ? true
    : App extends string ? Value extends LiteralValue<"string"> ? true : false
    : App extends number ? Value extends LiteralValue<"int" | "float"> ? true : false
    : App extends boolean ? Value extends LiteralValue<"boolean"> ? true : false
    : true;

type ValidateCustomScalarValue<
    Value,
    Wire extends string,
    App,
    ScalarApp,
> = CustomScalarLiteralCompatible<Value, ScalarApp> extends true
    ? [ScalarApp] extends [App]
        ? ArgumentsSuccess<never>
        : GraphQLError<
            "INVALID_ARGUMENT_VALUE",
            "application-branded inputs require a variable"
        >
    : GraphQLError<
        "INVALID_ARGUMENT_VALUE",
        `literal is incompatible with ${Wire}`
    >;

type EnumLiteralAllowed<Values, Name extends string> =
    [Values] extends [string] ? [Name] extends [Values] ? true : false
    : Values extends readonly unknown[] ? Name extends Values[number] & string ? true : false
    : Name extends keyof Values ? true : false;

type ScalarLiteralCompatible<Value, Wire extends string> =
    Value extends LiteralValue<"null">
        ? Wire extends `${string}!` ? false : true
    : StripNonNull<Wire> extends "Int"
        ? Value extends LiteralValue<"int"> ? true : false
    : StripNonNull<Wire> extends "Float"
        ? Value extends LiteralValue<"int" | "float"> ? true : false
    : StripNonNull<Wire> extends "Boolean"
        ? Value extends LiteralValue<"boolean"> ? true : false
    : StripNonNull<Wire> extends "String"
        ? Value extends LiteralValue<"string"> ? true : false
    : StripNonNull<Wire> extends "ID"
        ? Value extends LiteralValue<"string" | "int"> ? true : false
    : false;

type IsNarrowApplicationType<Wire extends string, App> =
    DefaultInputType<Wire> extends App ? false : true;

type ListItemApp<Inner extends string, App> =
    NonNullable<App> extends readonly (infer Item)[]
        ? Item
        : DefaultInputType<Inner>;

type ValidateListValues<
    Source extends string,
    ItemInput,
    S,
    Namespace extends string,
    Uses = never,
    Steps extends unknown[] = [],
> = Steps["length"] extends 64
    ? GraphQLError<"QUERY_TOO_COMPLEX", "list literal has too many values">
    : SkipIgnored<Source> extends infer Rest extends string
        ? Rest extends "" ? ArgumentsSuccess<Uses>
        : TakeValue<Rest> extends Match<infer Value, infer AfterValue extends string>
            ? ValidateValue<Value, ItemInput, S, Namespace> extends infer Validated
                ? Validated extends ArgumentsSuccess<infer NewUses>
                    ? ValidateListValues<
                        AfterValue,
                        ItemInput,
                        S,
                        Namespace,
                        Uses | NewUses,
                        [unknown, ...Steps]
                    >
                    : Validated
                : never
            : TakeValue<Rest>
        : never;

type ValidateObjectFields<
    Source extends string,
    Expected,
    S,
    Namespace extends string,
    Seen = never,
    Uses = never,
    Steps extends unknown[] = [],
> = Steps["length"] extends 64
    ? GraphQLError<"QUERY_TOO_COMPLEX", "input object literal has too many fields">
    : SkipIgnored<Source> extends infer Rest extends string
        ? Rest extends ""
            ? MissingRequired<Expected, Seen> extends infer Missing
                ? [Missing] extends [never] ? ArgumentsSuccess<Uses>
                : GraphQLError<
                    "MISSING_REQUIRED_ARGUMENT",
                    `missing required input field: ${Missing & string}`
                >
                : never
        : TakeName<Rest> extends Match<infer Name extends string, infer AfterName extends string>
            ? Name extends Seen
                ? GraphQLError<"DUPLICATE_ARGUMENT", `duplicate input field: ${Name}`>
                : Name extends keyof Expected
                    ? SkipIgnored<AfterName> extends `:${infer AfterColon}`
                        ? TakeValue<AfterColon> extends Match<
                            infer Value,
                            infer AfterValue extends string
                        >
                            ? ValidateValue<Value, Expected[Name], S, Namespace> extends infer Validated
                                ? Validated extends ArgumentsSuccess<infer NewUses>
                                    ? ValidateObjectFields<
                                        AfterValue,
                                        Expected,
                                        S,
                                        Namespace,
                                        Seen | Name,
                                        Uses | NewUses,
                                        [unknown, ...Steps]
                                    >
                                    : Validated
                                : never
                            : TakeValue<AfterColon>
                        : GraphQLError<"SYNTAX_ERROR", `expected : after input field ${Name}`>
                    : GraphQLError<"UNKNOWN_ARGUMENT", `unknown input field: ${Name}`>
            : TakeName<Rest>
        : never;

type ValidateValue<
    Value,
    Input,
    S = never,
    Namespace extends string = string,
> =
    Input extends GraphQLInput<infer Wire, infer App>
        ? Value extends VariableValue<infer Name>
            ? ArgumentsSuccess<VariableUse<Name, Input>>
        : Value extends LiteralValue<"null">
            ? Wire extends `${string}!`
                ? GraphQLError<"INVALID_ARGUMENT_VALUE", `literal is incompatible with ${Wire}`>
                : ArgumentsSuccess<never>
        : StripNonNull<Wire> extends `[${infer Inner}]`
            ? Value extends LiteralValue<"list", infer Body extends string>
                ? ValidateListValues<
                    Body,
                    GraphQLInput<Inner, ListItemApp<Inner, App>>,
                    S,
                    Namespace
                >
                : ValidateValue<
                    Value,
                    GraphQLInput<Inner, ListItemApp<Inner, App>>,
                    S,
                    Namespace
                >
        : InputFields<S, Namespace, StripNonNull<Wire>> extends infer Fields
            ? [Fields] extends [never]
                ? EnumValues<S, Namespace, StripNonNull<Wire>> extends infer Values
                    ? Value extends LiteralValue<"enum", infer Name extends string>
                        ? [Values] extends [never]
                            ? StripNonNull<Wire> extends BuiltInScalarName
                                ? GraphQLError<
                                    "INVALID_ARGUMENT_VALUE",
                                    `literal is incompatible with ${Wire}`
                                >
                                : ScalarAppType<S, Namespace, StripNonNull<Wire>> extends infer ScalarApp
                                    ? [ScalarApp] extends [never]
                                        ? ArgumentsSuccess<never>
                                        : ValidateCustomScalarValue<Value, Wire, App, ScalarApp>
                                    : never
                            : EnumLiteralAllowed<Values, Name> extends true
                                ? ArgumentsSuccess<never>
                                : GraphQLError<
                                    "INVALID_ARGUMENT_VALUE",
                                    `unknown enum value ${Name} for ${StripNonNull<Wire>}`
                                >
                    : ScalarLiteralCompatible<Value, Wire> extends true
                        ? IsNarrowApplicationType<Wire, App> extends true
                            ? GraphQLError<
                                "INVALID_ARGUMENT_VALUE",
                                "application-branded inputs require a variable"
                            >
                            : ArgumentsSuccess<never>
                        : StripNonNull<Wire> extends BuiltInScalarName
                            ? GraphQLError<
                                "INVALID_ARGUMENT_VALUE",
                                `literal is incompatible with ${Wire}`
                            >
                            : ScalarAppType<S, Namespace, StripNonNull<Wire>> extends infer ScalarApp
                                ? [ScalarApp] extends [never]
                                    ? GraphQLError<
                                        "INVALID_ARGUMENT_VALUE",
                                        `literal is incompatible with ${Wire}`
                                    >
                                    : ValidateCustomScalarValue<Value, Wire, App, ScalarApp>
                                : never
                    : never
                : Value extends LiteralValue<"object", infer Body extends string>
                    ? ValidateObjectFields<Body, Fields, S, Namespace>
                    : GraphQLError<
                        "INVALID_ARGUMENT_VALUE",
                        `literal is incompatible with ${Wire}`
                    >
            : never
        : GraphQLError<"INVALID_SCHEMA", "argument metadata must use GraphQLInput">;

export type ValidateDefaultValue<
    Value,
    Wire extends string,
    S = never,
    Namespace extends string = string,
> =
    ValidateValue<
        Value,
        GraphQLInput<Wire, DefaultInputType<Wire>>,
        S,
        Namespace
    > extends infer Validated
        ? Validated extends GraphQLError ? Validated
        : Validated extends ArgumentsSuccess<infer Uses>
            ? [Uses] extends [never] ? Validated
            : GraphQLError<
                "SYNTAX_ERROR",
                "variable default value must be constant"
            >
        : GraphQLError<
            "SYNTAX_ERROR",
            "could not validate variable default value"
        >
        : never;

type RequiredArgumentKeys<Expected> = {
    [K in keyof Expected]:
        Expected[K] extends GraphQLInput<infer Wire, unknown>
            ? Wire extends `${string}!` ? K : never
            : never;
}[keyof Expected];

type MissingRequired<Expected, Seen> = Exclude<RequiredArgumentKeys<Expected>, Seen>;

type ValidateArgumentsWorker<
    S extends string,
    Expected,
    Schema = never,
    Namespace extends string = string,
    Seen = never,
    Uses = never,
    Steps extends unknown[] = [],
> = Steps["length"] extends 64
    ? GraphQLError<"QUERY_TOO_COMPLEX", "field has too many arguments">
    : SkipIgnored<S> extends infer Rest extends string
        ? Rest extends ""
            ? MissingRequired<Expected, Seen> extends infer Missing
                ? [Missing] extends [never] ? ArgumentsSuccess<Uses>
                : GraphQLError<
                    "MISSING_REQUIRED_ARGUMENT",
                    `missing required argument: ${Missing & string}`
                >
                : never
            : TakeName<Rest> extends Match<
                infer Name extends string,
                infer AfterName extends string
            >
                ? Name extends Seen
                    ? GraphQLError<"DUPLICATE_ARGUMENT", `duplicate argument: ${Name}`>
                    : Name extends keyof Expected
                        ? SkipIgnored<AfterName> extends `:${infer AfterColon}`
                            ? TakeValue<AfterColon> extends Match<
                                infer Value,
                                infer AfterValue extends string
                            >
                                ? ValidateValue<
                                    Value,
                                    Expected[Name],
                                    Schema,
                                    Namespace
                                > extends infer Validated
                                    ? Validated extends ArgumentsSuccess<infer NewUses>
                                        ? ValidateArgumentsWorker<
                                            AfterValue,
                                            Expected,
                                            Schema,
                                            Namespace,
                                            Seen | Name,
                                            Uses | NewUses,
                                            [unknown, ...Steps]
                                        >
                                        : Validated
                                    : never
                                : TakeValue<AfterColon>
                            : GraphQLError<"SYNTAX_ERROR", `expected : after argument ${Name}`>
                        : GraphQLError<"UNKNOWN_ARGUMENT", `unknown argument: ${Name}`>
                : TakeName<Rest>
        : never;

export type ValidateArguments<
    Source extends string,
    Expected,
    S = never,
    Namespace extends string = string,
> = ValidateArgumentsWorker<Source, Expected, S, Namespace>;

export type ArgumentUses<T> =
    T extends ArgumentsSuccess<infer Uses> ? Uses : never;

export type VariableApplicationType<Use> =
    Use extends VariableUse<string, infer Input> ? InputApplicationType<Input> : never;
