import type { GraphQLError } from "../diagnostics.js";

export interface Match<Out, Rest extends string> {
    out: Out;
    rest: Rest;
}

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type Letter =
    | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
    | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z"
    | "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m"
    | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";

type NameStart = Letter | "_";
type NameContinue = NameStart | Digit;
type Ignored = " " | "\n" | "\r" | "\t" | "," | "\ufeff";

export type SkipIgnored<S extends string> =
    S extends `#${infer _Comment}\n${infer Rest}` ? SkipIgnored<Rest>
    : S extends `#${string}` ? ""
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

type DriveString<R> =
    R extends { __chunk: [infer S extends string, infer Acc extends string] }
        ? DriveString<TakeStringBody<S, Acc>>
        : R;

type TakeBlockStringBody<S extends string> =
    S extends `${infer Body}${'"""'}${infer Rest}` ? Match<Body, Rest>
    : GraphQLError<"SYNTAX_ERROR", "unterminated block string literal">;

export type TakeString<S extends string> =
    SkipIgnored<S> extends `"""${infer Rest}` ? TakeBlockStringBody<Rest>
    : SkipIgnored<S> extends `"${infer Rest}` ? DriveString<TakeStringBody<Rest>>
    : GraphQLError<"UNEXPECTED_TOKEN", "expected string literal">;

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
        ? DelimitedWorker<Rest, Open, Close, Depth, `${Acc}#${Comment}\n`, [unknown, ...Steps]>
    : S extends `#${infer Comment}`
        ? GraphQLError<"SYNTAX_ERROR", `unterminated ${Open}${Close} group after comment ${Comment}`>
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
