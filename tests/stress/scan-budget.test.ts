import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type { GraphQLInput, ValidateGraphQL } from "../../src/index.js";

type Schema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: { f: boolean };
        };
    };
    arguments: {
        public: {
            Query: {
                f: {
                    text: GraphQLInput<"String">;
                };
            };
        };
    };
};

test("an oversized string literal fails with a diagnostic, not a tsc blowup", () => {
    // 64 chars, doubled 7 times = 8192 chars — past the 7,680-char string
    // scan budget (64 chunks x 120 steps) but far below tsc's OOM range.
    type C64 =
        "0123456789012345678901234567890123456789012345678901234567890123";
    type Double<S extends string> = `${S}${S}`;
    type Big = Double<Double<Double<Double<Double<Double<Double<C64>>>>>>>;

    expectTypeOf<
        ValidateGraphQL<`{ f(text: "${Big}") }`, Schema>
    >().toMatchTypeOf<{ code: "QUERY_TOO_COMPLEX"; }>();
});
