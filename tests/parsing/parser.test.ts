import { test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type { GraphQLError } from "../../src/diagnostics.js";
import { Kind } from "../../src/parsing/ast.js";
import type {
    ParseDocument,
    ParseSelection,
} from "../../src/parsing/parser.js";

type IsErr<T> = T extends GraphQLError ? true : false;

// Dig the first argument's value node out of a parsed bare selection so tests
// can assert the exact literal the parser inferred.
type FirstArgValue<Src extends string> = ParseSelection<Src> extends [
    { arguments: [ { value: infer V; }, ...any[] ]; },
    ...any[],
] ? V
    : never;

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

test("parser preserves boolean literals exactly", () => {
    // The whole point: `true` and `false` must infer distinct literal types,
    // not a widened `boolean`.
    expectTypeOf<FirstArgValue<"f(x: true)">>()
        .toEqualTypeOf<{ kind: Kind.BOOLEAN; value: true; }>();
    expectTypeOf<FirstArgValue<"f(x: false)">>()
        .toEqualTypeOf<{ kind: Kind.BOOLEAN; value: false; }>();
});

test("parser preserves numeric literal source text", () => {
    expectTypeOf<FirstArgValue<"f(x: 42)">>()
        .toEqualTypeOf<{ kind: Kind.INT; value: "42"; }>();
    expectTypeOf<FirstArgValue<"f(x: -1.5e3)">>()
        .toEqualTypeOf<{ kind: Kind.FLOAT; value: "-1.5e3"; }>();
});

test("parser preserves string literal source text", () => {
    expectTypeOf<FirstArgValue<'f(s: "hi")'>>()
        .toEqualTypeOf<{ kind: Kind.STRING; value: "hi"; block: false; }>();

    // Raw source is preserved verbatim: the escape stays as the two characters
    // backslash-n, undecoded.
    expectTypeOf<FirstArgValue<'f(s: "a\\nb")'>>()
        .toEqualTypeOf<{ kind: Kind.STRING; value: "a\\nb"; block: false; }>();

    // Block strings carry their raw inner text and are flagged `block: true`.
    expectTypeOf<FirstArgValue<'f(s: """ok""")'>>()
        .toEqualTypeOf<{ kind: Kind.STRING; value: "ok"; block: true; }>();
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
