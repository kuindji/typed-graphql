import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type { tokenize, TokenizeError } from "../../src/parsing/tokenize.js";

test("tokenizer type-level behavior", () => {
    // A well-formed selection tokenizes to a non-error array.
    type Good = tokenize<"{ id name }">;
    expectTypeOf<Good extends TokenizeError ? true : false>().toEqualTypeOf<false>();

    // A stray unmatched character fails explicitly, carrying the remainder.
    type Bad = tokenize<"{ id % }">;
    expectTypeOf<Bad extends TokenizeError ? true : false>().toEqualTypeOf<true>();
});

test("tokenizer rejects an unterminated variable sigil", () => {
    type Bad = tokenize<"{ user($) }">;
    expectTypeOf<Bad extends TokenizeError ? true : false>().toEqualTypeOf<true>();
});

test("tokenizer rejects unterminated strings", () => {
    type Bad = tokenize<'{ f(arg: " ) }'>;
    expectTypeOf<Bad extends TokenizeError ? true : false>().toEqualTypeOf<true>();

    type BadBlock = tokenize<'{ f(arg: """ ) }'>;
    expectTypeOf<BadBlock extends TokenizeError ? true : false>().toEqualTypeOf<true>();
});

test("tokenizer accepts terminated strings", () => {
    type Good = tokenize<'{ f(arg: "ok") }'>;
    expectTypeOf<Good extends TokenizeError ? true : false>().toEqualTypeOf<false>();

    type GoodBlock = tokenize<'{ f(arg: """ok""") }'>;
    expectTypeOf<GoodBlock extends TokenizeError ? true : false>().toEqualTypeOf<false>();
});

test("tokenizer rejects malformed numbers", () => {
    expectTypeOf<tokenize<"{ f(x: 1.) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>(); // fractional part needs a digit
    expectTypeOf<tokenize<"{ f(x: 1e+) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>(); // exponent needs a digit
    expectTypeOf<tokenize<"{ f(x: 01) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>(); // leading zero
});

test("tokenizer accepts well-formed numbers", () => {
    expectTypeOf<tokenize<"{ f(x: 0) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<false>();
    expectTypeOf<tokenize<"{ f(x: 42) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<false>();
    expectTypeOf<tokenize<"{ f(x: -3.14) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<false>();
    expectTypeOf<tokenize<"{ f(x: 6.022e23) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<false>();
    expectTypeOf<tokenize<"{ f(x: 1e-9) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<false>();
});

test("tokenizer validates string escape sequences and line terminators", () => {
    // A valid escaped backslash is a complete, well-formed string.
    expectTypeOf<tokenize<'{ f(arg: "\\\\") }'> extends TokenizeError ? true : false>()
        .toEqualTypeOf<false>();

    // A valid escaped quote does not terminate the string prematurely.
    expectTypeOf<tokenize<'{ f(arg: "a\\"b") }'> extends TokenizeError ? true : false>()
        .toEqualTypeOf<false>();

    // A \uXXXX escape with four hex digits is accepted.
    expectTypeOf<tokenize<'{ f(arg: "\\u00e9") }'> extends TokenizeError ? true : false>()
        .toEqualTypeOf<false>();

    // An invalid escape sequence (\q) is rejected.
    expectTypeOf<tokenize<'{ f(arg: "\\q") }'> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>();

    // A \u escape with a non-hex digit is rejected.
    expectTypeOf<tokenize<'{ f(arg: "\\u00zz") }'> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>();

    // A raw line terminator inside a string is rejected.
    expectTypeOf<tokenize<'{ f(arg: "a\nb") }'> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>();
});

test("tokenizer rejects a number immediately followed by a name char", () => {
    // `[1a]` must not tokenize as two list values (1, a).
    expectTypeOf<tokenize<"{ f(x: [1a]) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>();
    // A float immediately followed by a name char is likewise invalid.
    expectTypeOf<tokenize<"{ f(x: 1.2e3x) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>();
});

test("tokenizer rejects variable and directive names starting with a digit", () => {
    expectTypeOf<tokenize<"{ f(x: $1x) }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>();
    expectTypeOf<tokenize<"{ f @1x }"> extends TokenizeError ? true : false>()
        .toEqualTypeOf<true>();
});
