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
