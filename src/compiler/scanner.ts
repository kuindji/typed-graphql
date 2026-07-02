import type { GraphQLError } from "../diagnostics.js";

export interface Match<Out, Rest extends string> {
    out: Out;
    rest: Rest;
}

// A naked union source distributes through every conditional in the
// compiler, compiling each member independently: a template literal with 4
// interpolations of a 6-member union expands to 6^4 = 1,296 documents
// (~7.8M instantiations) from ~120 chars of source. Entry points check this
// and reject union sources outright before any distribution starts. `never`
// stays false so it keeps flowing through the compiler unchanged.
export type IsUnionSource<T, U = T> = [T] extends [never] ? false
    : T extends unknown ? ([U] extends [T] ? false : true)
    : never;

export type UnionSourceError = GraphQLError<
    "UNSUPPORTED_SOURCE",
    "source must be a single string type, not a union of strings"
>;

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type Letter =
    | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
    | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z"
    | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
    | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";

type NameStart = Letter | "_";
type NameContinue = NameStart | Digit;
type Ignored = " " | "\n" | "\r" | "\t" | "," | "\ufeff";

// Comments end at any line terminator (spec §2.1.2): a `\r` before the first
// `\n` terminates the comment on its own.
export type SkipIgnored<S extends string> =
    S extends `#${infer Comment}\n${infer Rest}`
        ? Comment extends `${string}\r${infer AfterCr}`
            ? SkipIgnored<`${AfterCr}\n${Rest}`>
            : SkipIgnored<Rest>
    : S extends `#${infer Comment}`
        ? Comment extends `${string}\r${infer AfterCr}`
            ? SkipIgnored<AfterCr>
            : ""
    : S extends `${Ignored}${infer Rest}` ? SkipIgnored<Rest>
    : S;

type TakeNameTail<
    S extends string,
    Acc extends string,
    Steps extends unknown[] = [],
> = Steps["length"] extends 128
    ? GraphQLError<"QUERY_TOO_COMPLEX", "GraphQL name exceeds 128 characters">
    : S extends `${infer C}${infer Rest}`
        ? C extends NameContinue
            ? TakeNameTail<Rest, `${Acc}${C}`, [unknown, ...Steps]>
            : Match<Acc, S>
        : Match<Acc, "">;

export type TakeName<S extends string> =
    SkipIgnored<S> extends `${infer C}${infer Rest}`
        ? C extends NameStart ? TakeNameTail<Rest, C>
        : GraphQLError<"UNEXPECTED_TOKEN", "expected GraphQL name">
    : GraphQLError<"UNEXPECTED_TOKEN", "expected GraphQL name">;

type Hex =
    | Digit
    | "a" | "b" | "c" | "d" | "e" | "f"
    | "A" | "B" | "C" | "D" | "E" | "F";

type TakeStringBody<
    S extends string,
    Acc extends string = "",
    Steps extends unknown[] = [],
> = Steps["length"] extends 120
    ? { __chunk: [S, Acc] }
    : S extends `"${infer Rest}` ? Match<Acc, Rest>
    : S extends `\\u${infer A}${infer B}${infer C}${infer D}${infer Rest}`
        ? A extends Hex
            ? B extends Hex
                ? C extends Hex
                    ? D extends Hex
                        ? TakeStringBody<Rest, `${Acc}\\u${A}${B}${C}${D}`, [unknown, ...Steps]>
                        : GraphQLError<"SYNTAX_ERROR", "invalid unicode escape">
                    : GraphQLError<"SYNTAX_ERROR", "invalid unicode escape">
                : GraphQLError<"SYNTAX_ERROR", "invalid unicode escape">
            : GraphQLError<"SYNTAX_ERROR", "invalid unicode escape">
    : S extends `\\${infer Esc}${infer Rest}`
        ? Esc extends '"' | "\\" | "/" | "b" | "f" | "n" | "r" | "t"
            ? TakeStringBody<Rest, `${Acc}\\${Esc}`, [unknown, ...Steps]>
            : GraphQLError<"SYNTAX_ERROR", "invalid string escape">
    : S extends `${"\n" | "\r"}${string}`
        ? GraphQLError<"SYNTAX_ERROR", "line break in string literal">
    : S extends `${infer C}${infer Rest}`
        ? TakeStringBody<Rest, `${Acc}${C}`, [unknown, ...Steps]>
    : GraphQLError<"SYNTAX_ERROR", "unterminated string literal">;

// Same 64-chunk cap as DelimitedDrive/DriveSelection: without it an
// arbitrarily long string literal accumulates one string type per character
// until tsc runs out of heap.
type DriveString<R, Chunks extends unknown[] = []> =
    Chunks["length"] extends 64
        ? GraphQLError<
            "QUERY_TOO_COMPLEX",
            "string literal exceeds compiler scan budget"
        >
        : R extends { __chunk: [infer S extends string, infer Acc extends string] }
            ? DriveString<TakeStringBody<S, Acc>, [unknown, ...Chunks]>
            : R;

// A `"""` preceded by `\` is the block-string escape (spec §2.9.4), not the
// terminator; the escape is kept verbatim in the body.
type TakeBlockStringBody<S extends string, Acc extends string = ""> =
    S extends `${infer Body}${'"""'}${infer Rest}`
        ? Body extends `${string}\\`
            ? TakeBlockStringBody<Rest, `${Acc}${Body}"""`>
            : Match<`${Acc}${Body}`, Rest>
    : GraphQLError<"SYNTAX_ERROR", "unterminated block string literal">;

// SourceCharacter (spec §2.2) excludes C0 controls other than tab and the
// line terminators, so a raw NUL/BEL/etc. must be escaped, not embedded.
// Line terminators are handled by the string workers themselves (rejected
// in quoted strings, kept in block strings), leaving this shared exclusion
// set; tab stays valid.
type ControlCharacter =
    | "\u0000" | "\u0001" | "\u0002" | "\u0003" | "\u0004" | "\u0005"
    | "\u0006" | "\u0007" | "\u0008" | "\u000b" | "\u000c" | "\u000e"
    | "\u000f" | "\u0010" | "\u0011" | "\u0012" | "\u0013" | "\u0014"
    | "\u0015" | "\u0016" | "\u0017" | "\u0018" | "\u0019" | "\u001a"
    | "\u001b" | "\u001c" | "\u001d" | "\u001e" | "\u001f";

// One containment check on the completed body instead of a per-character
// test in the scan loop, which would tax every string on every compile.
type RejectControlCharacters<R> =
    R extends Match<infer Body extends string, string>
        ? Body extends `${string}${ControlCharacter}${string}`
            ? GraphQLError<
                "SYNTAX_ERROR",
                "control character in string literal must be escaped"
            >
            : R
        : R;

export type TakeString<S extends string> =
    SkipIgnored<S> extends `"""${infer Rest}`
        ? RejectControlCharacters<TakeBlockStringBody<Rest>>
    : SkipIgnored<S> extends `"${infer Rest}`
        ? RejectControlCharacters<DriveString<TakeStringBody<Rest>>>
    : GraphQLError<"UNEXPECTED_TOKEN", "expected string literal">;

// Comments are handled before whitespace: stripping the line terminator
// first would fuse a comment with the source that follows it.
type CompactPlain<S extends string> =
    S extends `${infer A}#${infer C}`
        ? C extends `${infer Comment}\n${infer B}`
            ? Comment extends `${string}\r${infer AfterCr}`
                ? CompactPlain<`${A}${AfterCr}\n${B}`>
                : CompactPlain<`${A}${B}`>
            : C extends `${string}\r${infer B}`
                ? CompactPlain<`${A}${B}`>
                : CompactPlain<A>
    : S extends `${infer A} ${infer B}` ? CompactPlain<`${A}${B}`>
    : S extends `${infer A}\n${infer B}` ? CompactPlain<`${A}${B}`>
    : S extends `${infer A}\r${infer B}` ? CompactPlain<`${A}${B}`>
    : S extends `${infer A}\t${infer B}` ? CompactPlain<`${A}${B}`>
    : S extends `${infer A},${infer B}` ? CompactPlain<`${A}${B}`>
    : S;

type TakeQuotedBody<S extends string, Acc extends string = ""> =
    S extends `${infer Body}"${infer Rest}`
        ? Body extends `${string}\\`
            ? TakeQuotedBody<Rest, `${Acc}${Body}"`>
            : Match<`${Acc}${Body}`, Rest>
        : Match<`${Acc}${S}`, "">;

// Strips ignored tokens (whitespace, commas, comments) outside string
// literals only, so string arguments keep their exact content when compared
// for field conflicts.
export type Compact<S extends string> =
    S extends `${infer Before}"${infer After}`
        ? After extends `""${infer BlockRest}`
            ? BlockRest extends `${infer Body}"""${infer Rest}`
                ? `${CompactPlain<Before>}"""${Body}"""${Compact<Rest>}`
                : `${CompactPlain<Before>}"""${BlockRest}`
            : TakeQuotedBody<After> extends Match<
                infer Body extends string,
                infer Rest extends string
            >
                ? `${CompactPlain<Before>}"${Body}"${Compact<Rest>}`
                : never
        : CompactPlain<S>;

type Pop<T extends unknown[]> = T extends [unknown, ...infer Rest] ? Rest : [];

type DelimitedWorker<
    S extends string,
    Open extends string,
    Close extends string,
    Depth extends unknown[],
    Acc extends string,
    Steps extends unknown[] = [],
> = Steps["length"] extends 120
    ? { __chunk: [S, Depth, Acc] }
    : S extends `#${infer Comment}\n${infer Rest}`
        ? Comment extends `${infer BeforeCr}\r${infer AfterCr}`
            ? DelimitedWorker<`${AfterCr}\n${Rest}`, Open, Close, Depth, `${Acc}#${BeforeCr}\r`, [unknown, ...Steps]>
            : DelimitedWorker<Rest, Open, Close, Depth, `${Acc}#${Comment}\n`, [unknown, ...Steps]>
    : S extends `#${infer Comment}`
        ? Comment extends `${infer BeforeCr}\r${infer AfterCr}`
            ? DelimitedWorker<AfterCr, Open, Close, Depth, `${Acc}#${BeforeCr}\r`, [unknown, ...Steps]>
            : GraphQLError<"SYNTAX_ERROR", `unterminated ${Open}${Close} group after comment ${Comment}`>
    : S extends `"""${infer Rest}`
        ? TakeBlockStringBody<Rest> extends Match<infer Body extends string, infer R extends string>
            ? DelimitedWorker<R, Open, Close, Depth, `${Acc}"""${Body}"""`, [unknown, ...Steps]>
            : TakeBlockStringBody<Rest>
    : S extends `"${infer Rest}`
        ? DriveString<TakeStringBody<Rest>> extends Match<
            infer Body extends string,
            infer R extends string
        >
            ? DelimitedWorker<R, Open, Close, Depth, `${Acc}"${Body}"`, [unknown, ...Steps]>
            : DriveString<TakeStringBody<Rest>>
    : S extends `${Open}${infer Rest}`
        ? DelimitedWorker<Rest, Open, Close, [unknown, ...Depth], `${Acc}${Open}`, [unknown, ...Steps]>
    : S extends `${Close}${infer Rest}`
        ? Depth extends [unknown]
            ? Match<Acc, Rest>
            : DelimitedWorker<Rest, Open, Close, Pop<Depth>, `${Acc}${Close}`, [unknown, ...Steps]>
    : S extends `${infer C}${infer Rest}`
        ? DelimitedWorker<Rest, Open, Close, Depth, `${Acc}${C}`, [unknown, ...Steps]>
    : GraphQLError<"SYNTAX_ERROR", `unterminated ${Open}${Close} group`>;

type DelimitedDrive<
    R,
    Open extends string,
    Close extends string,
    Chunks extends unknown[] = [],
> = Chunks["length"] extends 64
    ? GraphQLError<"QUERY_TOO_COMPLEX", "GraphQL source exceeds structural scan budget">
    : R extends {
        __chunk: [
            infer S extends string,
            infer Depth extends unknown[],
            infer Acc extends string,
        ];
    }
        ? DelimitedDrive<
            DelimitedWorker<S, Open, Close, Depth, Acc>,
            Open,
            Close,
            [unknown, ...Chunks]
        >
        : R;

export type TakeBraced<S extends string> =
    SkipIgnored<S> extends `{${infer Rest}`
        ? DelimitedDrive<DelimitedWorker<Rest, "{", "}", [unknown], "">, "{", "}">
        : GraphQLError<"UNEXPECTED_TOKEN", "expected selection set">;

export type TakeParenthesized<S extends string> =
    SkipIgnored<S> extends `(${infer Rest}`
        ? DelimitedDrive<DelimitedWorker<Rest, "(", ")", [unknown], "">, "(", ")">
        : GraphQLError<"UNEXPECTED_TOKEN", "expected parenthesized group">;

export type TakeBracketed<S extends string> =
    SkipIgnored<S> extends `[${infer Rest}`
        ? DelimitedDrive<DelimitedWorker<Rest, "[", "]", [unknown], "">, "[", "]">
        : GraphQLError<"UNEXPECTED_TOKEN", "expected bracketed group">;
