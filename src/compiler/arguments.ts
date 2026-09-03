import type { GraphQLError } from "../diagnostics.js";
import type {
    DefaultInputType,
    GraphQLInput,
    GraphQLSchema,
    InputApplicationType,
} from "../schema.js";
import type {
    Compact,
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
    | "_"
    | "A"
    | "B"
    | "C"
    | "D"
    | "E"
    | "F"
    | "G"
    | "H"
    | "I"
    | "J"
    | "K"
    | "L"
    | "M"
    | "N"
    | "O"
    | "P"
    | "Q"
    | "R"
    | "S"
    | "T"
    | "U"
    | "V"
    | "W"
    | "X"
    | "Y"
    | "Z"
    | "a"
    | "b"
    | "c"
    | "d"
    | "e"
    | "f"
    | "g"
    | "h"
    | "i"
    | "j"
    | "k"
    | "l"
    | "m"
    | "n"
    | "o"
    | "p"
    | "q"
    | "r"
    | "s"
    | "t"
    | "u"
    | "v"
    | "w"
    | "x"
    | "y"
    | "z";

interface NumberScan<Kind extends "int" | "float", Rest extends string> {
    kind: Kind;
    rest: Rest;
}

type SkipDigits<S extends string> = S extends `${Digit}${infer Rest}`
    ? SkipDigits<Rest>
    : S;

type SkipInteger<S extends string> = S extends `0${Digit}${string}` ? never
    : S extends `0${infer Rest}` ? Rest
    : S extends `${NonZeroDigit}${infer Rest}` ? SkipDigits<Rest>
    : never;

type SkipExponent<S extends string> = S extends `${"+" | "-"}${infer Rest}`
    ? Rest extends `${Digit}${string}` ? SkipDigits<Rest> : never
    : S extends `${Digit}${string}` ? SkipDigits<S>
    : never;

type ScanFractionExponent<S extends string> = S extends `.${infer Fraction}`
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

type GuardNumberEnd<Scan> = Scan extends NumberScan<infer Kind, infer Rest>
    ? Rest extends `${NameStart | Digit | "."}${string}` ? never
    : NumberScan<Kind, Rest>
    : never;

type ScanNumber<S extends string> = S extends `-${infer Positive}`
    ? SkipInteger<Positive> extends infer Rest extends string
        ? GuardNumberEnd<ScanFractionExponent<Rest>>
    : never
    : SkipInteger<S> extends infer Rest extends string
        ? GuardNumberEnd<ScanFractionExponent<Rest>>
    : never;

// The source of the scanned number is the prefix of `S` preceding the
// unconsumed `Rest`. `Rest` always begins with a non-numeric delimiter
// (GuardNumberEnd forbids a trailing digit/`.`/name char), so it never occurs
// inside the numeric prefix and the first-occurrence split is unambiguous.
type ConsumedNumber<S extends string, Rest extends string> = Rest extends "" ? S
    : S extends `${infer Num}${Rest}` ? Num
    : S;

type TakeNumber<S extends string> = [ ScanNumber<S> ] extends [ never ]
    ? GraphQLError<"SYNTAX_ERROR", "invalid numeric literal">
    : ScanNumber<S> extends NumberScan<infer Kind, infer Rest>
        ? Match<LiteralValue<Kind, ConsumedNumber<S, Rest>>, Rest>
    : GraphQLError<"SYNTAX_ERROR", "invalid numeric literal">;

export type TakeValue<S extends string> = SkipIgnored<S> extends
    `$${infer Rest}` ? TakeName<Rest> extends Match<
        infer Name extends string,
        infer After extends string
    > ? Match<VariableValue<Name>, After>
    : TakeName<Rest>
    : SkipIgnored<S> extends `"""${string}` | `"${string}`
        ? TakeString<S> extends
            Match<infer Value extends string, infer Rest extends string>
            ? Match<LiteralValue<"string", Value>, Rest>
        : TakeString<S>
    : SkipIgnored<S> extends `[${string}` ? TakeBracketed<S> extends Match<
            infer Body extends string,
            infer Rest extends string
        > ? Match<LiteralValue<"list", Body>, Rest>
        : TakeBracketed<S>
    : SkipIgnored<S> extends `{${string}` ? TakeBraced<S> extends Match<
            infer Body extends string,
            infer Rest extends string
        > ? Match<LiteralValue<"object", Body>, Rest>
        : TakeBraced<S>
    : SkipIgnored<S> extends `${infer First}${string}`
        ? First extends Digit | "-" ? TakeNumber<SkipIgnored<S>>
        : TakeName<S> extends Match<
            infer Name extends string,
            infer After extends string
        > ? Match<
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

type StripNonNull<Wire extends string> = Wire extends `${infer Inner}!` ? Inner
    : Wire;

type InputFields<
    S,
    Namespace extends string,
    Name extends string,
> = S extends GraphQLSchema
    ? S extends { inputs: infer Inputs; }
        ? Namespace extends keyof Inputs
            ? Name extends keyof Inputs[Namespace] ? Inputs[Namespace][Name]
            : Name extends keyof Inputs ? Inputs[Name]
            : never
        : Name extends keyof Inputs ? Inputs[Name]
        : never
    : never
    : never;

type EnumValues<
    S,
    Namespace extends string,
    Name extends string,
> = S extends GraphQLSchema
    ? S extends { enums: infer Enums; }
        ? Namespace extends keyof Enums
            ? Name extends keyof Enums[Namespace] ? Enums[Namespace][Name]
            : Name extends keyof Enums ? Enums[Name]
            : never
        : Name extends keyof Enums ? Enums[Name]
        : never
    : never
    : never;

type BuiltInScalarName = "Int" | "Float" | "Boolean" | "String" | "ID";

type ScalarAppType<
    S,
    Namespace extends string,
    Name extends string,
> = S extends GraphQLSchema
    ? S extends { scalars: infer Scalars; }
        ? Namespace extends keyof Scalars
            ? Name extends keyof Scalars[Namespace] ? Scalars[Namespace][Name]
            : Name extends keyof Scalars ? Scalars[Name]
            : never
        : Name extends keyof Scalars ? Scalars[Name]
        : never
    : never
    : never;

type CustomScalarLiteralCompatible<Value, App> = [ unknown ] extends [ App ]
    ? true
    : App extends string ? Value extends LiteralValue<"string"> ? true : false
    : App extends number
        ? Value extends LiteralValue<"int" | "float"> ? true : false
    : App extends boolean ? Value extends LiteralValue<"boolean"> ? true : false
    : true;

type ValidateCustomScalarValue<
    Value,
    Wire extends string,
    App,
    ScalarApp,
> = CustomScalarLiteralCompatible<Value, ScalarApp> extends true
    ? [ ScalarApp ] extends [ App ] ? ArgumentsSuccess<never>
    : GraphQLError<
        "INVALID_ARGUMENT_VALUE",
        "application-branded inputs require a variable"
    >
    : GraphQLError<
        "INVALID_ARGUMENT_VALUE",
        `literal is incompatible with ${Wire}`
    >;

// A custom scalar the schema does not list under `scalars` is validated
// against the argument's own application type (GraphQLInput<"timestamptz",
// string>): the literal must fit the app type's primitive shape, and — as for
// built-in scalars — a branded app type (UserId, not string) requires a
// variable. An `unknown` app type accepts any literal.
type LiteralPrimitive<Value> = Value extends LiteralValue<"string"> ? string
    : Value extends LiteralValue<"int" | "float"> ? number
    : Value extends LiteralValue<"boolean"> ? boolean
    : never;

type ValidateUndeclaredScalarValue<Value, Wire extends string, App> =
    CustomScalarLiteralCompatible<Value, App> extends true
        ? LiteralPrimitive<Value> extends infer Primitive
            ? [ Primitive ] extends [ never ] ? ArgumentsSuccess<never>
            : [ Primitive ] extends [ App ] ? ArgumentsSuccess<never>
            : GraphQLError<
                "INVALID_ARGUMENT_VALUE",
                "application-branded inputs require a variable"
            >
        : never
        : GraphQLError<
            "INVALID_ARGUMENT_VALUE",
            `literal is incompatible with ${Wire}`
        >;

type EnumLiteralAllowed<Values, Name extends string> = [ Values ] extends
    [ string ] ? [ Name ] extends [ Values ] ? true : false
    : Values extends readonly unknown[]
        ? Name extends Values[number] & string ? true : false
    : Name extends keyof Values ? true
    : false;

type ScalarLiteralCompatible<Value, Wire extends string> = Value extends
    LiteralValue<"null"> ? Wire extends `${string}!` ? false : true
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

// Digits strictly less than the given decimal digit — the per-position
// comparator for equal-length magnitude strings.
type DigitsLessThan<D extends string> = D extends "0" ? never
    : D extends "1" ? "0"
    : D extends "2" ? "0" | "1"
    : D extends "3" ? "0" | "1" | "2"
    : D extends "4" ? "0" | "1" | "2" | "3"
    : D extends "5" ? "0" | "1" | "2" | "3" | "4"
    : D extends "6" ? "0" | "1" | "2" | "3" | "4" | "5"
    : D extends "7" ? "0" | "1" | "2" | "3" | "4" | "5" | "6"
    : D extends "8" ? "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7"
    : D extends "9" ? "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8"
    : never;

// Lexicographic compare of two equal-length digit strings.
type LexCompareDigits<A extends string, B extends string> = A extends
    `${infer AH}${infer AR}`
    ? B extends `${infer BH}${infer BR}`
        ? AH extends BH ? LexCompareDigits<AR, BR>
        : BH extends DigitsLessThan<AH> ? "gt"
        : "lt"
    : "gt"
    : "eq";

// Length of a magnitude relative to ten digits, counted by single-character
// peels so the ten-position digit union never materializes. `${infer}` chains
// bind one character each, sidestepping the `Digit`-union cross-product.
type MagnitudeLength<Mag extends string> = Mag extends
    `${infer _0}${infer _1}${infer _2}${infer _3}${infer _4}${infer _5}${infer _6}${infer _7}${infer _8}${infer _9}${infer Rest}`
    ? Rest extends "" ? "eq10" : "gt10"
    : "lt10";

// True when `Mag` (a leading-zero-free decimal magnitude) is <= `Bound`, a
// fixed ten-digit bound. Fewer digits ⇒ smaller; more ⇒ larger; equal length
// ⇒ lexicographic.
type MagnitudeLte<Mag extends string, Bound extends string> =
    MagnitudeLength<Mag> extends "gt10" ? false
        : MagnitudeLength<Mag> extends "lt10" ? true
        : LexCompareDigits<Mag, Bound> extends "gt" ? false
        : true;

// Spec §3.5.1: Int is a signed 32-bit value, i.e. [-2147483648, 2147483647].
type IntInRange<Source extends string> = Source extends
    `-${infer Mag extends string}` ? MagnitudeLte<Mag, "2147483648">
    : MagnitudeLte<Source, "2147483647">;

// Non-`never` only when `Wire` is Int and `Value` is an out-of-range int
// literal; wrapped around ValidateValue's body so every other case is untouched.
type IntRangeError<Wire extends string, Value> = StripNonNull<Wire> extends
    "Int"
    ? Value extends LiteralValue<"int", infer Source extends string>
        ? IntInRange<Source> extends false ? GraphQLError<
                "INT_OUT_OF_RANGE",
                `Int value ${Source} is outside the 32-bit signed range`
            >
        : never
    : never
    : never;

type IsNarrowApplicationType<Wire extends string, App> =
    DefaultInputType<Wire> extends App ? false : true;

// A list argument with the default app type validates its items against the
// item's default app type (so a `$x: Int!` used as an `[Int]` item is
// `number`, not `number | null` — item nullability belongs to the list value,
// variable nullability to the variable). An explicit list app type
// (`GraphQLInput<"[ID!]!", UserId[]>`) supplies the item type directly.
type ListItemApp<Inner extends string, App> =
    SameLiteral<DefaultInputType<`[${Inner}]`>, App> extends true
        ? DefaultInputType<Inner>
        : NonNullable<App> extends readonly (infer Item)[] ? Item
        : DefaultInputType<Inner>;

type ValidateListValues<
    Source extends string,
    ItemInput,
    S,
    Namespace extends string,
    Depth extends unknown[],
    Uses = never,
    Steps extends unknown[] = [],
> = Steps["length"] extends 64
    ? GraphQLError<"QUERY_TOO_COMPLEX", "list literal has too many values">
    : SkipIgnored<Source> extends infer Rest extends string
        ? Rest extends "" ? ArgumentsSuccess<Uses>
        : TakeValue<Rest> extends
            Match<infer Value, infer AfterValue extends string>
            ? ValidateValue<Value, ItemInput, S, Namespace, Depth> extends
                infer Validated
                ? Validated extends ArgumentsSuccess<infer NewUses>
                    ? ValidateListValues<
                        AfterValue,
                        ItemInput,
                        S,
                        Namespace,
                        Depth,
                        Uses | NewUses,
                        [ unknown, ...Steps ]
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
    Depth extends unknown[],
    Seen = never,
    Uses = never,
    Steps extends unknown[] = [],
> = Steps["length"] extends 64 ? GraphQLError<
        "QUERY_TOO_COMPLEX",
        "input object literal has too many fields"
    >
    : SkipIgnored<Source> extends infer Rest extends string
        ? Rest extends ""
            ? MissingRequired<Expected, Seen> extends infer Missing
                ? [ Missing ] extends [ never ] ? ArgumentsSuccess<Uses>
                : GraphQLError<
                    "MISSING_REQUIRED_ARGUMENT",
                    `missing required input field: ${Missing & string}`
                >
            : never
        : TakeName<Rest> extends
            Match<infer Name extends string, infer AfterName extends string>
            ? Name extends Seen ? GraphQLError<
                    "DUPLICATE_ARGUMENT",
                    `duplicate input field: ${Name}`
                >
            : Name extends keyof Expected
                ? SkipIgnored<AfterName> extends `:${infer AfterColon}`
                    ? TakeValue<AfterColon> extends Match<
                        infer Value,
                        infer AfterValue extends string
                    > ? ValidateValue<
                            Value,
                            Expected[Name],
                            S,
                            Namespace,
                            Depth
                        > extends infer Validated
                            ? Validated extends ArgumentsSuccess<infer NewUses>
                                ? ValidateObjectFields<
                                    AfterValue,
                                    Expected,
                                    S,
                                    Namespace,
                                    Depth,
                                    Seen | Name,
                                    Uses | NewUses,
                                    [ unknown, ...Steps ]
                                >
                            : Validated
                        : never
                    : TakeValue<AfterColon>
                : GraphQLError<
                    "SYNTAX_ERROR",
                    `expected : after input field ${Name}`
                >
            : GraphQLError<"UNKNOWN_ARGUMENT", `unknown input field: ${Name}`>
        : TakeName<Rest>
    : never;

// Depth guards the ValidateValue <-> ValidateObjectFields/ValidateListValues
// recursion: breadth is capped per level (64 fields/values), but nesting was
// unbounded and overflowed tsc's instantiation stack at ~85 levels.
type ValidateValue<
    Value,
    Input,
    S = never,
    Namespace extends string = string,
    Depth extends unknown[] = [],
> = Depth["length"] extends 32 ? GraphQLError<
        "QUERY_TOO_COMPLEX",
        "input value nesting exceeds compiler depth budget"
    >
    : Input extends GraphQLInput<infer Wire, infer App>
        ? [ IntRangeError<Wire, Value> ] extends [ never ]
            ? Value extends VariableValue<infer Name>
                ? ArgumentsSuccess<VariableUse<Name, Input>>
            : Value extends LiteralValue<"null">
                ? Wire extends `${string}!` ? GraphQLError<
                        "INVALID_ARGUMENT_VALUE",
                        `literal is incompatible with ${Wire}`
                    >
                : ArgumentsSuccess<never>
            : StripNonNull<Wire> extends `[${infer Inner}]`
                ? Value extends LiteralValue<"list", infer Body extends string>
                    ? ValidateListValues<
                        Body,
                        GraphQLInput<Inner, ListItemApp<Inner, App>>,
                        S,
                        Namespace,
                        [ unknown, ...Depth ]
                    >
                : ValidateValue<
                    Value,
                    GraphQLInput<Inner, ListItemApp<Inner, App>>,
                    S,
                    Namespace,
                    [ unknown, ...Depth ]
                >
            : InputFields<S, Namespace, StripNonNull<Wire>> extends infer Fields
                ? [ Fields ] extends [ never ]
                    ? EnumValues<S, Namespace, StripNonNull<Wire>> extends
                        infer Values
                        ? Value extends
                            LiteralValue<"enum", infer Name extends string>
                            ? [ Values ] extends [ never ]
                                ? StripNonNull<Wire> extends BuiltInScalarName
                                    ? GraphQLError<
                                        "INVALID_ARGUMENT_VALUE",
                                        `literal is incompatible with ${Wire}`
                                    >
                                : ScalarAppType<
                                    S,
                                    Namespace,
                                    StripNonNull<Wire>
                                > extends infer ScalarApp
                                    ? [ ScalarApp ] extends [ never ]
                                        ? ArgumentsSuccess<never>
                                    : ValidateCustomScalarValue<
                                        Value,
                                        Wire,
                                        App,
                                        ScalarApp
                                    >
                                : never
                            : EnumLiteralAllowed<Values, Name> extends true
                                ? ArgumentsSuccess<never>
                            : GraphQLError<
                                "INVALID_ARGUMENT_VALUE",
                                `unknown enum value ${Name} for ${StripNonNull<
                                    Wire
                                >}`
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
                        : ScalarAppType<
                            S,
                            Namespace,
                            StripNonNull<Wire>
                        > extends infer ScalarApp
                            ? [ ScalarApp ] extends [ never ]
                                ? ValidateUndeclaredScalarValue<
                                    Value,
                                    Wire,
                                    App
                                >
                            : ValidateCustomScalarValue<
                                Value,
                                Wire,
                                App,
                                ScalarApp
                            >
                        : never
                    : never
                : Value extends
                    LiteralValue<"object", infer Body extends string>
                    ? ValidateObjectFields<
                        Body,
                        Fields,
                        S,
                        Namespace,
                        [ unknown, ...Depth ]
                    >
                : GraphQLError<
                    "INVALID_ARGUMENT_VALUE",
                    `literal is incompatible with ${Wire}`
                >
            : never
        : IntRangeError<Wire, Value>
    : GraphQLError<"INVALID_SCHEMA", "argument metadata must use GraphQLInput">;

export type ValidateDefaultValue<
    Value,
    Wire extends string,
    S = never,
    Namespace extends string = string,
> = ValidateValue<
    Value,
    GraphQLInput<Wire, DefaultInputType<Wire>>,
    S,
    Namespace
> extends infer Validated ? Validated extends GraphQLError ? Validated
    : Validated extends ArgumentsSuccess<infer Uses>
        ? [ Uses ] extends [ never ] ? Validated
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
    [K in keyof Expected]: Expected[K] extends GraphQLInput<infer Wire, unknown>
        ? Wire extends `${string}!` ? K : never
        : never;
}[keyof Expected];

type MissingRequired<Expected, Seen> = Exclude<
    RequiredArgumentKeys<Expected>,
    Seen
>;

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
                ? [ Missing ] extends [ never ] ? ArgumentsSuccess<Uses>
                : GraphQLError<
                    "MISSING_REQUIRED_ARGUMENT",
                    `missing required argument: ${Missing & string}`
                >
            : never
        : TakeName<Rest> extends Match<
            infer Name extends string,
            infer AfterName extends string
        > ? Name extends Seen ? GraphQLError<
                    "DUPLICATE_ARGUMENT",
                    `duplicate argument: ${Name}`
                >
            : Name extends keyof Expected
                ? SkipIgnored<AfterName> extends `:${infer AfterColon}`
                    ? TakeValue<AfterColon> extends Match<
                        infer Value,
                        infer AfterValue extends string
                    > ? ValidateValue<
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
                                    [ unknown, ...Steps ]
                                >
                            : Validated
                        : never
                    : TakeValue<AfterColon>
                : GraphQLError<
                    "SYNTAX_ERROR",
                    `expected : after argument ${Name}`
                >
            : GraphQLError<"UNKNOWN_ARGUMENT", `unknown argument: ${Name}`>
        : TakeName<Rest>
    : never;

export type ValidateArguments<
    Source extends string,
    Expected,
    S = never,
    Namespace extends string = string,
> = ValidateArgumentsWorker<Source, Expected, S, Namespace>;

export type ArgumentUses<T> = T extends ArgumentsSuccess<infer Uses> ? Uses
    : never;

type SameLiteral<A, B> = [ A ] extends [ B ]
    ? ([ B ] extends [ A ] ? true : false)
    : false;

interface ArgumentEntry<Name extends string, Value> {
    name: Name;
    value: Value;
}

interface InvalidFingerprint {
    __invalidArgumentFingerprint: true;
}

type NumberTokenChar = Digit | "." | "-" | "+" | "e" | "E";

// TakeValue erases the source text of numeric literals, so field-conflict
// fingerprints capture the raw token instead.
type TakeNumberToken<S extends string, Acc extends string = ""> = S extends
    `${infer C}${infer Rest}`
    ? C extends NumberTokenChar ? TakeNumberToken<Rest, `${Acc}${C}`>
    : Match<Acc, S>
    : Match<Acc, "">;

// List and object literal bodies are compared as compacted source, so
// whitespace and comments cannot force a conflict but ordering inside a
// nested literal still can.
type CanonicalizeValue<V> = V extends
    LiteralValue<infer Kind extends string, infer Source extends string>
    ? Kind extends "list" | "object" ? LiteralValue<Kind, Compact<Source>>
    : V
    : V;

type TakeCanonicalValue<S extends string> = SkipIgnored<S> extends
    `${infer First}${string}`
    ? First extends Digit | "-" ? TakeNumberToken<SkipIgnored<S>> extends Match<
            infer Raw extends string,
            infer Rest extends string
        > ? Match<LiteralValue<"number", Raw>, Rest>
        : never
    : TakeValue<S> extends Match<infer Value, infer Rest extends string>
        ? Match<CanonicalizeValue<Value>, Rest>
    : InvalidFingerprint
    : InvalidFingerprint;

// The set of `name: value` entries in an argument list; unordered because it
// accumulates as a union, per spec §5.3.2 ("identical sets of arguments").
type ArgumentFingerprint<
    S extends string,
    Acc = never,
    Steps extends unknown[] = [],
> = Steps["length"] extends 64 ? InvalidFingerprint
    : SkipIgnored<S> extends "" ? Acc
    : TakeName<S> extends Match<
        infer Name extends string,
        infer AfterName extends string
    >
        ? SkipIgnored<AfterName> extends `:${infer AfterColon}`
            ? TakeCanonicalValue<AfterColon> extends Match<
                infer Value,
                infer Rest extends string
            > ? ArgumentFingerprint<
                    Rest,
                    Acc | ArgumentEntry<Name, Value>,
                    [ unknown, ...Steps ]
                >
            : InvalidFingerprint
        : InvalidFingerprint
    : InvalidFingerprint;

// Spec §5.3.2: fields merge only with identical argument sets. Textual
// comparison first (cheap, covers the overwhelmingly common case), then a
// structural fingerprint so argument order and comments cannot force a
// FIELD_CONFLICT. An unparsable list never fingerprints equal.
export type SameArguments<A extends string, B extends string> =
    SameLiteral<A, B> extends true ? true
        : SameLiteral<Compact<A>, Compact<B>> extends true ? true
        : ArgumentFingerprint<A> extends infer FA
            ? [ FA ] extends [ InvalidFingerprint ] ? false
            : ArgumentFingerprint<B> extends infer FB
                ? [ FB ] extends [ InvalidFingerprint ] ? false
                : SameLiteral<FA, FB>
            : never
        : never;

export type VariableApplicationType<Use> = Use extends
    VariableUse<string, infer Input> ? InputApplicationType<Input> : never;
