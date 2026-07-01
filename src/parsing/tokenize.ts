import type { _match } from "./ast.js";

export const enum Token {
    Name,
    Var,
    Directive,
    Spread,
    Exclam,
    Equal,
    Colon,
    BraceOpen,
    BraceClose,
    ParenOpen,
    ParenClose,
    BracketOpen,
    BracketClose,
    BlockString,
    String,
    Integer,
    Float,
}

type ignored = " " | "\n" | "\t" | "\r" | "," | "\ufeff";

type digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

// prettier-ignore
type letter =
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

type skipIgnored<In> = In extends `#${infer _}\n${infer In}` ? skipIgnored<In>
    : In extends `#${infer _}` ? ""
    : In extends `${ignored}${infer In}` ? skipIgnored<In>
    : In;

type nonZeroDigit = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type skipDigits<In> = In extends `${digit}${infer In}` ? skipDigits<In> : In;

// Spec-compliant numeric scanner (GraphQL §2.9.1 / §2.9.2). The tokenizer
// enters `scanNumber` only when the input starts with a digit (optionally after
// a `-`); the result carries both the token kind and the unconsumed remainder,
// or `void` when the literal is malformed (rejected as a `TokenizeError`).
//
// Rejected forms: leading zeros (`01`), a fractional part with no digit (`1.`),
// and an exponent with no digit (`1e+`).
interface _num<K extends Token, R extends string> {
    kind: K;
    rest: R;
}

// IntegerPart: `0` on its own, or a non-zero digit followed by more digits. A
// `0` immediately followed by another digit is a leading-zero error (`void`).
type skipIntegerPart<In> = In extends `0${digit}${string}` ? void
    : In extends `0${infer R}` ? R
    : In extends `${nonZeroDigit}${infer R}` ? skipDigits<R>
    : void;

// After the exponent marker: an optional sign then at least one digit.
type skipExponentDigits<In> = In extends `${"+" | "-"}${infer R}`
    ? R extends `${digit}${string}` ? skipDigits<R> : void
    : In extends `${digit}${string}` ? skipDigits<In> : void;

// Given the remainder after the integer part, resolve the fractional and
// exponent parts and classify the literal as Integer or Float.
type scanFractionExponent<In extends string> = In extends `.${infer R}`
    ? R extends `${digit}${string}`
        // FractionalPart present (one or more digits after `.`).
        ? skipDigits<R> extends `${"e" | "E"}${infer E}`
            ? skipExponentDigits<E> extends `${infer Rest}`
                ? _num<Token.Float, Rest>
            : void
        : _num<Token.Float, skipDigits<R>>
    : void // `.` not followed by a digit
    : In extends `${"e" | "E"}${infer E}`
        // ExponentPart with no fractional part.
        ? skipExponentDigits<E> extends `${infer Rest}` ? _num<Token.Float, Rest>
        : void
    : _num<Token.Integer, In>;

// A numeric literal must not be immediately followed by a `.`, a Digit, or a
// NameStart (`letter`/`_`) — GraphQL §2.9.1/§2.9.2. Without this guard `1a`
// would scan as an integer `1` leaving `a` to tokenize as a name, so `[1a]`
// would parse as two list values. A following Digit cannot actually occur (the
// integer/fraction/exponent scanners consume all adjacent digits), but it is
// listed for spec fidelity.
type guardNumberEnd<N> = N extends _num<infer K, infer R>
    ? R extends `${letter | "_" | digit | "."}${string}` ? void : N
    : void;

type scanNumber<In> = In extends `-${infer R}`
    ? skipIntegerPart<R> extends `${infer After}`
        ? guardNumberEnd<scanFractionExponent<After>>
    : void
    : skipIntegerPart<In> extends `${infer After}`
        ? guardNumberEnd<scanFractionExponent<After>>
    : void;

// A `void` result is the error sentinel for an unterminated string: no closing
// delimiter was found. The tokenizer turns that into a `TokenizeError` rather
// than silently retokenizing the unterminated remainder as fresh source.
type skipBlockString<In> = In extends `${infer Hd}${'"""'}${infer In}`
    ? Hd extends `${string}${"\\"}` ? skipBlockString<In>
    : In
    : void;

// The characters that may legally follow a `\` inside a (non-block) string
// (GraphQL §2.9.4 EscapedCharacter), plus the hex digits for `\uXXXX` and the
// LineTerminators a raw string character may not be.
type stringEscapeChar = '"' | "\\" | "/" | "b" | "f" | "n" | "r" | "t";
type hexDigit =
    | digit
    | "a" | "b" | "c" | "d" | "e" | "f"
    | "A" | "B" | "C" | "D" | "E" | "F";
type lineTerminator = "\n" | "\r";

// Scan a (non-block) StringValue body one character at a time, starting just
// after the opening quote. Returns the unconsumed remainder after the closing
// quote, or `void` for a malformed literal: an invalid escape sequence, a
// `\uXXXX` escape whose four characters are not all hex, a raw line terminator,
// or an unterminated string (end of input before a closing quote). Unlike the
// prior `Hd extends ...${"\\"}` check, this counts backslashes correctly, so a
// literal escaped backslash (`"\\"`) terminates while `"\""` does not.
type skipString<In> = In extends `"${infer Rest}` ? Rest
    : In extends `\\u${infer A}${infer B}${infer C}${infer D}${infer Rest}`
        ? A extends hexDigit
            ? B extends hexDigit
                ? C extends hexDigit ? D extends hexDigit ? skipString<Rest>
                    : void
                : void
            : void
        : void
    : In extends `\\${infer Esc}${infer Rest}`
        ? Esc extends stringEscapeChar ? skipString<Rest> : void
    : In extends `${lineTerminator}${string}` ? void
    : In extends `${infer _First}${infer Rest}` ? skipString<Rest>
    : void;

type takeNameLiteralRec<
    PrevMatch extends string,
    In extends string,
> = In extends `${infer Match}${infer Out}`
    ? Match extends letter | digit | "_"
        ? takeNameLiteralRec<`${PrevMatch}${Match}`, Out>
    : _match<PrevMatch, In>
    : _match<PrevMatch, In>;

export interface VarTokenNode<Name extends string = string> {
    kind: Token.Var;
    name: Name;
}

export interface NameTokenNode<Name extends string = string> {
    kind: Token.Name;
    name: Name;
}

export interface DirectiveTokenNode<Name extends string = string> {
    kind: Token.Directive;
    name: Name;
}

export type TokenNode =
    | Token
    | NameTokenNode
    | VarTokenNode
    | DirectiveTokenNode;

interface _state<In extends string, Out extends TokenNode[]> {
    out: Out;
    in: In;
}

export interface TokenizeError<Rest extends string = string> {
    readonly __tokenizeError: true;
    rest: Rest;
}

// NOTE: This tokenizer is wrapped with the `_state` interface to facilitate it
// becoming tail-recursive. Hardened vs the reference: an error short-circuits
// the whole recursion, and every "no rule matched" `void` fall-through is
// replaced with a `TokenizeError<In>` carrying the unconsumed remainder.
// prettier-ignore
type tokenizeRec<State> =
    State extends TokenizeError ? State
    : State extends _state<"", any> ? State["out"]
    : State extends _state<infer In, infer Out> ? tokenizeRec<
        In extends `#${string}` ? _state<skipIgnored<In>, Out>
        : In extends `${ignored}${string}` ? _state<skipIgnored<In>, Out>
        : In extends `...${infer R}` ? _state<R, [ ...Out, Token.Spread ]>
        : In extends `!${infer R}` ? _state<R, [ ...Out, Token.Exclam ]>
        : In extends `=${infer R}` ? _state<R, [ ...Out, Token.Equal ]>
        : In extends `:${infer R}` ? _state<R, [ ...Out, Token.Colon ]>
        : In extends `{${infer R}` ? _state<R, [ ...Out, Token.BraceOpen ]>
        : In extends `}${infer R}` ? _state<R, [ ...Out, Token.BraceClose ]>
        : In extends `(${infer R}` ? _state<R, [ ...Out, Token.ParenOpen ]>
        : In extends `)${infer R}` ? _state<R, [ ...Out, Token.ParenClose ]>
        : In extends `[${infer R}` ? _state<R, [ ...Out, Token.BracketOpen ]>
        : In extends `]${infer R}` ? _state<R, [ ...Out, Token.BracketClose ]>
        : In extends `"""${infer R}`
            ? (skipBlockString<R> extends `${infer Rest}`
                ? _state<Rest, [ ...Out, Token.BlockString ]>
                : TokenizeError<In>)
        : In extends `"${infer R}`
            ? (skipString<R> extends `${infer Rest}`
                ? _state<Rest, [ ...Out, Token.String ]>
                : TokenizeError<In>)
        : In extends `-${digit}${string}` | `${digit}${string}`
            ? (scanNumber<In> extends _num<infer K, infer R>
                ? _state<R, [ ...Out, K ]>
                : TokenizeError<In>)
        : In extends `$${infer R}`
            ? (R extends `${letter | "_"}${string}`
                ? (takeNameLiteralRec<"", R> extends _match<infer Match, infer R2>
                    ? _state<R2 & string, [ ...Out, VarTokenNode<Match & string> ]>
                    : TokenizeError<In>)
                : TokenizeError<In>)
        : In extends `@${infer R}`
            ? (R extends `${letter | "_"}${string}`
                ? (takeNameLiteralRec<"", R> extends _match<infer Match, infer R2>
                    ? _state<R2 & string, [ ...Out, DirectiveTokenNode<Match & string> ]>
                    : TokenizeError<In>)
                : TokenizeError<In>)
        : In extends `${letter | "_"}${string}`
            ? (takeNameLiteralRec<"", In> extends _match<infer Match, infer R2>
                ? _state<R2 & string, [ ...Out, NameTokenNode<Match & string> ]>
                : TokenizeError<In>)
        : TokenizeError<In>
      >
    : [];

export type tokenize<In extends string> = tokenizeRec<_state<In, []>>;
