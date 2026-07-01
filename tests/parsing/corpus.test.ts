import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type { ParseGraphQL, ParseSelection } from "../../src/index.js";
import type { GraphQLError } from "../../src/index.js";

type IsErr<T> = T extends GraphQLError ? true : false;

test("positive corpus: representative valid documents parse", () => {
    expectTypeOf<IsErr<ParseGraphQL<"{ id name }">>>().toEqualTypeOf<false>(); // shorthand
    expectTypeOf<IsErr<ParseGraphQL<"query Q { id }">>>().toEqualTypeOf<false>(); // named op
    expectTypeOf<IsErr<ParseGraphQL<"query Q($id: ID!) { user(id: $id) { id } }">>>()
        .toEqualTypeOf<false>(); // vars + args
    expectTypeOf<IsErr<ParseGraphQL<"{ handle: name }">>>().toEqualTypeOf<false>(); // alias
    expectTypeOf<IsErr<ParseGraphQL<"{ id @include(if: true) }">>>().toEqualTypeOf<false>(); // directive
    expectTypeOf<IsErr<ParseGraphQL<"{ ...F } fragment F on User { id }">>>()
        .toEqualTypeOf<false>(); // fragment
    expectTypeOf<IsErr<ParseGraphQL<"mutation { add(x: [1, 2], y: { a: null }) { id } }">>>()
        .toEqualTypeOf<false>(); // list/object/null values
});

test("negative corpus: malformed documents produce diagnostics", () => {
    expectTypeOf<IsErr<ParseGraphQL<"{ id name">>>().toEqualTypeOf<true>(); // unclosed brace
    expectTypeOf<IsErr<ParseGraphQL<"{ id } garbage">>>().toEqualTypeOf<true>(); // trailing garbage
    expectTypeOf<IsErr<ParseGraphQL<"">>>().toEqualTypeOf<true>(); // empty
    expectTypeOf<IsErr<ParseSelection<"id name %">>>().toEqualTypeOf<true>(); // stray char in selection
});
