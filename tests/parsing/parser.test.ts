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
});

test("parser propagates tokenizer failure", () => {
    type Doc = ParseDocument<"{ id % }">;
    expectTypeOf<IsErr<Doc>>().toEqualTypeOf<true>();
});
