import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type {
    GetReturnType,
    IsValidGraphQL,
    ValidateGraphQL,
    ValidateSelection,
} from "../../src/index.js";

type UnionSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {
                f: string;
                g: string;
                h: string;
                i: string;
                j: string;
                k: string;
            };
        };
    };
};

test("a union query source is an explicit diagnostic, not N compilations", () => {
    // Every entry point distributes over a naked union source, compiling
    // each member independently. Both members below are individually valid,
    // so before the guard this resolved to true — a deterministic failure
    // for this assertion, never a vacuous TS2589 pass.
    type Two = "{ f }" | "{ g }";

    expectTypeOf<ValidateGraphQL<Two, UnionSchema>>()
        .toMatchTypeOf<{ code: "UNSUPPORTED_SOURCE"; }>();
    expectTypeOf<IsValidGraphQL<Two, UnionSchema>>().toEqualTypeOf<false>();
    expectTypeOf<GetReturnType<Two, UnionSchema>>().toBeNever();
});

test("a template-literal cross-product source is rejected before it explodes", () => {
    // 4 interpolations of a 6-member union expand to 6^4 = 1,296 query
    // strings from ~120 chars of source; compiling each cost ~7.8M
    // instantiations. The guard must reject the union before distribution.
    type F6 = "f" | "g" | "h" | "i" | "j" | "k";
    type Bomb = `{ a1:${F6} a2:${F6} a3:${F6} a4:${F6} }`;

    expectTypeOf<ValidateGraphQL<Bomb, UnionSchema>>()
        .toMatchTypeOf<{ code: "UNSUPPORTED_SOURCE"; }>();
    expectTypeOf<IsValidGraphQL<Bomb, UnionSchema>>().toEqualTypeOf<false>();
});

test("a union selection source is rejected the same way", () => {
    expectTypeOf<ValidateSelection<"f" | "g", UnionSchema, "Query">>()
        .toMatchTypeOf<{ code: "UNSUPPORTED_SOURCE"; }>();

    // Single-literal sources (including template patterns) still compile.
    expectTypeOf<ValidateSelection<"f g", UnionSchema, "Query">>()
        .toEqualTypeOf<true>();
    expectTypeOf<IsValidGraphQL<"{ f }", UnionSchema>>().toEqualTypeOf<true>();
});
