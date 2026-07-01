import { test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { GraphQLError } from "../../src/diagnostics.js";
import type {
    ParseDocument,
    ParseSelection,
} from "../../src/parsing/parser.js";

type IsErr<T> = T extends GraphQLError ? true : false;

test("parser accepts valid documents and selections", () => {
    type Doc = ParseDocument<"{ id name }">;
    expectTypeOf<IsErr<Doc>>().toEqualTypeOf<false>();

    type Sel = ParseSelection<"id name user { id }">;
    expectTypeOf<IsErr<Sel>>().toEqualTypeOf<false>();
});

test("parser rejects trailing unconsumed tokens instead of silently truncating", () => {
    // A closing brace with no opener leaves an unconsumed token.
    type Doc = ParseDocument<"{ id } }">;
    expectTypeOf<IsErr<Doc>>().toEqualTypeOf<true>();

    // ParseSelection also rejects trailing unconsumed tokens.
    type Sel = ParseSelection<"id name }">;
    expectTypeOf<IsErr<Sel>>().toEqualTypeOf<true>();
});

test("parser propagates tokenizer failure", () => {
    type Doc = ParseDocument<"{ id % }">;
    expectTypeOf<IsErr<Doc>>().toEqualTypeOf<true>();

    // ParseSelection also propagates tokenizer failure.
    type Sel = ParseSelection<"id % name">;
    expectTypeOf<IsErr<Sel>>().toEqualTypeOf<true>();
});

test("parser rejects empty documents", () => {
    type Doc = ParseDocument<"">;
    expectTypeOf<IsErr<Doc>>().toEqualTypeOf<true>();
});

test("parser rejects empty required productions", () => {
    // Empty selection set.
    expectTypeOf<IsErr<ParseDocument<"{}">>>().toEqualTypeOf<true>();
    // Empty argument list.
    expectTypeOf<IsErr<ParseDocument<"{ f() }">>>().toEqualTypeOf<true>();
    // Empty variable-definition list.
    expectTypeOf<IsErr<ParseDocument<"query Q() { id }">>>().toEqualTypeOf<true>();
    // Empty bare selection.
    expectTypeOf<IsErr<ParseSelection<"">>>().toEqualTypeOf<true>();
});

test("parser rejects the reserved fragment name `on`", () => {
    expectTypeOf<IsErr<ParseSelection<"...on">>>().toEqualTypeOf<true>();

    // A fragment *definition* may not be named `on` either.
    expectTypeOf<IsErr<ParseDocument<"fragment on on User { id }">>>()
        .toEqualTypeOf<true>();

    // A legitimately-named fragment definition still parses.
    expectTypeOf<IsErr<ParseDocument<"fragment F on User { id }">>>()
        .toEqualTypeOf<false>();
});
