import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type {
    GetReturnType,
    GraphQLInput,
    IsValidGraphQL,
    ValidateGraphQL,
} from "../../src/index.js";

type DeepSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: { leaf: string };
        };
    };
    relations: {
        public: {
            Query: {
                self: { type: "Query"; nullable: true };
            };
        };
    };
};

type FilterSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: { f: string };
        };
    };
    arguments: {
        public: {
            Query: {
                f: { where: GraphQLInput<"Filter"> };
            };
        };
    };
    inputs: {
        public: {
            Filter: {
                child: GraphQLInput<"Filter">;
                value: GraphQLInput<"Int">;
            };
        };
    };
};

test("selection nesting past the depth budget is an explicit diagnostic", () => {
    // Depth 48 previously crashed tsc with TS2589 and silently widened
    // IsValidGraphQL/GetReturnType to any, so both true and false assertions
    // passed. The guard must produce a GraphQLError and a literal false.
    type Deep48 = "{ self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { leaf } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } } }";

    expectTypeOf<ValidateGraphQL<Deep48, DeepSchema>>()
        .toMatchTypeOf<{ code: "QUERY_TOO_COMPLEX"; }>();
    expectTypeOf<IsValidGraphQL<Deep48, DeepSchema>>().toEqualTypeOf<false>();

    // Under the budget, nesting still compiles and infers.
    type Deep12 = "{ self { self { self { self { self { self { self { self { self { self { self { self { leaf } } } } } } } } } } } } }";
    expectTypeOf<IsValidGraphQL<Deep12, DeepSchema>>().toEqualTypeOf<true>();
    expectTypeOf<GetReturnType<Deep12, DeepSchema>>()
        .toMatchTypeOf<{ self: { self: object | null } | null }>();
});

test("duplicate-field merging past its depth budget is an explicit diagnostic", () => {
    // Two duplicates of the same field whose sub-selections differ all the
    // way down force the field-merge conflict check to recurse per level;
    // past its budget that must be a diagnostic, not TS2589.
    type Merge18 = "{ self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { a: leaf } } } } } } } } } } } } } } } } } } self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { self { b: leaf } } } } } } } } } } } } } } } } } } }";

    expectTypeOf<ValidateGraphQL<Merge18, DeepSchema>>()
        .toMatchTypeOf<{ code: "QUERY_TOO_COMPLEX"; }>();
    expectTypeOf<IsValidGraphQL<Merge18, DeepSchema>>().toEqualTypeOf<false>();

    // Under the budget, the duplicates merge into one shape.
    type Merge3 = "{ self { self { self { a: leaf } } } self { self { self { b: leaf } } } }";
    expectTypeOf<IsValidGraphQL<Merge3, DeepSchema>>().toEqualTypeOf<true>();
    expectTypeOf<GetReturnType<Merge3, DeepSchema>>().toEqualTypeOf<{
        self: {
            self: {
                self: { a: string; b: string } | null;
            } | null;
        } | null;
    }>();
});

test("a linear fragment-spread chain past the depth budget is diagnosed", () => {
    type Chain48 = "query Q { ...F0 } fragment F0 on Query { ...F1 } fragment F1 on Query { ...F2 } fragment F2 on Query { ...F3 } fragment F3 on Query { ...F4 } fragment F4 on Query { ...F5 } fragment F5 on Query { ...F6 } fragment F6 on Query { ...F7 } fragment F7 on Query { ...F8 } fragment F8 on Query { ...F9 } fragment F9 on Query { ...F10 } fragment F10 on Query { ...F11 } fragment F11 on Query { ...F12 } fragment F12 on Query { ...F13 } fragment F13 on Query { ...F14 } fragment F14 on Query { ...F15 } fragment F15 on Query { ...F16 } fragment F16 on Query { ...F17 } fragment F17 on Query { ...F18 } fragment F18 on Query { ...F19 } fragment F19 on Query { ...F20 } fragment F20 on Query { ...F21 } fragment F21 on Query { ...F22 } fragment F22 on Query { ...F23 } fragment F23 on Query { ...F24 } fragment F24 on Query { ...F25 } fragment F25 on Query { ...F26 } fragment F26 on Query { ...F27 } fragment F27 on Query { ...F28 } fragment F28 on Query { ...F29 } fragment F29 on Query { ...F30 } fragment F30 on Query { ...F31 } fragment F31 on Query { ...F32 } fragment F32 on Query { ...F33 } fragment F33 on Query { ...F34 } fragment F34 on Query { ...F35 } fragment F35 on Query { ...F36 } fragment F36 on Query { ...F37 } fragment F37 on Query { ...F38 } fragment F38 on Query { ...F39 } fragment F39 on Query { ...F40 } fragment F40 on Query { ...F41 } fragment F41 on Query { ...F42 } fragment F42 on Query { ...F43 } fragment F43 on Query { ...F44 } fragment F44 on Query { ...F45 } fragment F45 on Query { ...F46 } fragment F46 on Query { ...F47 } fragment F47 on Query { leaf }";

    expectTypeOf<ValidateGraphQL<Chain48, DeepSchema>>()
        .toMatchTypeOf<{ code: "QUERY_TOO_COMPLEX"; }>();

    type Chain8 = "query Q { ...F0 } fragment F0 on Query { ...F1 } fragment F1 on Query { ...F2 } fragment F2 on Query { ...F3 } fragment F3 on Query { ...F4 } fragment F4 on Query { ...F5 } fragment F5 on Query { ...F6 } fragment F6 on Query { ...F7 } fragment F7 on Query { leaf }";
    expectTypeOf<IsValidGraphQL<Chain8, DeepSchema>>().toEqualTypeOf<true>();
});

test("a fragment cycle longer than the depth budget is still diagnosed", () => {
    // Small cycles are caught by the Visited set as FRAGMENT_CYCLE; a cycle
    // longer than the depth budget must hit the depth guard, not TS2589.
    type Cycle48 = "query Q { ...F0 } fragment F0 on Query { ...F1 } fragment F1 on Query { ...F2 } fragment F2 on Query { ...F3 } fragment F3 on Query { ...F4 } fragment F4 on Query { ...F5 } fragment F5 on Query { ...F6 } fragment F6 on Query { ...F7 } fragment F7 on Query { ...F8 } fragment F8 on Query { ...F9 } fragment F9 on Query { ...F10 } fragment F10 on Query { ...F11 } fragment F11 on Query { ...F12 } fragment F12 on Query { ...F13 } fragment F13 on Query { ...F14 } fragment F14 on Query { ...F15 } fragment F15 on Query { ...F16 } fragment F16 on Query { ...F17 } fragment F17 on Query { ...F18 } fragment F18 on Query { ...F19 } fragment F19 on Query { ...F20 } fragment F20 on Query { ...F21 } fragment F21 on Query { ...F22 } fragment F22 on Query { ...F23 } fragment F23 on Query { ...F24 } fragment F24 on Query { ...F25 } fragment F25 on Query { ...F26 } fragment F26 on Query { ...F27 } fragment F27 on Query { ...F28 } fragment F28 on Query { ...F29 } fragment F29 on Query { ...F30 } fragment F30 on Query { ...F31 } fragment F31 on Query { ...F32 } fragment F32 on Query { ...F33 } fragment F33 on Query { ...F34 } fragment F34 on Query { ...F35 } fragment F35 on Query { ...F36 } fragment F36 on Query { ...F37 } fragment F37 on Query { ...F38 } fragment F38 on Query { ...F39 } fragment F39 on Query { ...F40 } fragment F40 on Query { ...F41 } fragment F41 on Query { ...F42 } fragment F42 on Query { ...F43 } fragment F43 on Query { ...F44 } fragment F44 on Query { ...F45 } fragment F45 on Query { ...F46 } fragment F46 on Query { ...F47 } fragment F47 on Query { ...F0 }";

    expectTypeOf<ValidateGraphQL<Cycle48, DeepSchema>>()
        .toMatchTypeOf<{ code: "QUERY_TOO_COMPLEX" | "FRAGMENT_CYCLE"; }>();
});

test("input object nesting past the depth budget is an explicit diagnostic", () => {
    // Depth 96 previously crashed tsc with TS2589 (breadth is capped at 64
    // fields, depth was unbounded).
    type Input96 = `{ f(where: {child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{child:{value:1}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}}) }`;

    expectTypeOf<ValidateGraphQL<Input96, FilterSchema>>()
        .toMatchTypeOf<{ code: "QUERY_TOO_COMPLEX"; }>();

    type Input8 = `{ f(where: {child:{child:{child:{child:{child:{child:{child:{child:{value:1}}}}}}}}}) }`;
    expectTypeOf<IsValidGraphQL<Input8, FilterSchema>>().toEqualTypeOf<true>();
});
