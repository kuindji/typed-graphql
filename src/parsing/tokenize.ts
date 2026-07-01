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

type skipDigits<In> = In extends `${digit}${infer In}` ? skipDigits<In> : In;

// skipFloat's `void` is control flow, not an error: a `void` result means the
// number is an integer (no fractional/exponent part), while a string remainder
// means it is a float. This discrimination is preserved verbatim from the
// reference and must NOT be turned into a TokenizeError.
// prettier-ignore
type skipFloat<In> = In extends `${"."}${infer In}`
    ? skipDigits<In> extends `${"e" | "E"}${infer In}`
        ? skipDigits<In extends `${"+" | "-"}${infer In}` ? In : In>
    : skipDigits<In>
    : skipDigits<In> extends `${"e" | "E"}${infer In}`
        ? skipDigits<In extends `${"+" | "-"}${infer In}` ? In : In>
    : void;

type skipBlockString<In> = In extends `${infer Hd}${'"""'}${infer In}`
    ? Hd extends `${string}${"\\"}` ? skipBlockString<In>
    : In
    : In;
type skipString<In> = In extends `${infer Hd}${'"'}${infer In}`
    ? Hd extends `${string}${"\\"}` ? skipString<In>
    : In
    : In;

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
        : In extends `"""${infer R}` ? _state<skipBlockString<R>, [ ...Out, Token.BlockString ]>
        : In extends `"${infer R}` ? _state<skipString<R>, [ ...Out, Token.String ]>
        : In extends `-${digit}${infer R}`
            ? (skipFloat<skipDigits<R>> extends `${infer R2}`
                ? _state<R2, [ ...Out, Token.Float ]>
                : _state<skipDigits<R>, [ ...Out, Token.Integer ]>)
        : In extends `${digit}${infer R}`
            ? (skipFloat<skipDigits<R>> extends `${infer R2}`
                ? _state<R2, [ ...Out, Token.Float ]>
                : _state<skipDigits<R>, [ ...Out, Token.Integer ]>)
        : In extends `$${infer R}`
            ? (takeNameLiteralRec<"", R> extends _match<infer Match, infer R2>
                ? Match extends "" ? TokenizeError<In>
                : _state<R2 & string, [ ...Out, VarTokenNode<Match & string> ]>
                : TokenizeError<In>)
        : In extends `@${infer R}`
            ? (takeNameLiteralRec<"", R> extends _match<infer Match, infer R2>
                ? Match extends "" ? TokenizeError<In>
                : _state<R2 & string, [ ...Out, DirectiveTokenNode<Match & string> ]>
                : TokenizeError<In>)
        : In extends `${letter | "_"}${string}`
            ? (takeNameLiteralRec<"", In> extends _match<infer Match, infer R2>
                ? _state<R2 & string, [ ...Out, NameTokenNode<Match & string> ]>
                : TokenizeError<In>)
        : TokenizeError<In>
      >
    : [];

export type tokenize<In extends string> = tokenizeRec<_state<In, []>>;
