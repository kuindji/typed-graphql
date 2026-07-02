import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type {
    GetReturnType,
    GraphQLInput,
    IsValidGraphQL,
    ValidateGraphQL,
} from "../../src/index.js";

type Schema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {
                id: string;
                f: boolean;
            };
        };
    };
    arguments: {
        public: {
            Query: {
                f: {
                    int: GraphQLInput<"Int">;
                    float: GraphQLInput<"Float">;
                    text: GraphQLInput<"String">;
                };
            };
        };
    };
};

test("strict shallow parser rejects malformed document structure", () => {
    expectTypeOf<IsValidGraphQL<"", Schema>>().toEqualTypeOf<false>();
    expectTypeOf<IsValidGraphQL<"{}", Schema>>().toEqualTypeOf<false>();
    expectTypeOf<IsValidGraphQL<"{ id", Schema>>().toEqualTypeOf<false>();
    expectTypeOf<IsValidGraphQL<"{ id } }", Schema>>().toEqualTypeOf<false>();
    expectTypeOf<IsValidGraphQL<'{ id } "junk"', Schema>>()
        .toEqualTypeOf<false>();
    expectTypeOf<IsValidGraphQL<"query Q() { id }", Schema>>()
        .toEqualTypeOf<false>();
    expectTypeOf<IsValidGraphQL<"{ f() }", Schema>>()
        .toEqualTypeOf<false>();
});

test("strings and numeric literals are validated without token arrays", () => {
    expectTypeOf<IsValidGraphQL<'{ f(text: "ok") }', Schema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<IsValidGraphQL<'{ f(text: "\\u00e9") }', Schema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<IsValidGraphQL<'{ f(text: "\\q") }', Schema>>()
        .toEqualTypeOf<false>();
    expectTypeOf<IsValidGraphQL<"{ f(int: 01) }", Schema>>()
        .toEqualTypeOf<false>();
    expectTypeOf<IsValidGraphQL<"{ f(float: 1.) }", Schema>>()
        .toEqualTypeOf<false>();
    expectTypeOf<IsValidGraphQL<"{ f(float: 6.02e23) }", Schema>>()
        .toEqualTypeOf<true>();
});

test("raw control characters inside string literals are rejected", () => {
    expectTypeOf<ValidateGraphQL<'{ f(text: "a\u0007b") }', Schema>>()
        .toMatchTypeOf<{ code: "SYNTAX_ERROR"; }>();
    expectTypeOf<ValidateGraphQL<'{ f(text: "a\u0000b") }', Schema>>()
        .toMatchTypeOf<{ code: "SYNTAX_ERROR"; }>();
    expectTypeOf<ValidateGraphQL<'{ f(text: """a\u0007b""") }', Schema>>()
        .toMatchTypeOf<{ code: "SYNTAX_ERROR"; }>();
    // Tab is a valid SourceCharacter and stays allowed unescaped.
    expectTypeOf<IsValidGraphQL<'{ f(text: "a\tb") }', Schema>>()
        .toEqualTypeOf<true>();
});

test("include and skip directives affect result optionality", () => {
    expectTypeOf<GetReturnType<"{ id @include(if: true) }", Schema>>()
        .toEqualTypeOf<{ id: string }>();
    expectTypeOf<GetReturnType<"{ id @include(if: false) }", Schema>>()
        .toEqualTypeOf<{ id?: string }>();
    expectTypeOf<GetReturnType<"query Q($show: Boolean!) { id @include(if: $show) }", Schema>>()
        .toEqualTypeOf<{ id?: string }>();
    expectTypeOf<ValidateGraphQL<"{ id @unknown }", Schema>>()
        .toMatchTypeOf<{ code: "UNKNOWN_DIRECTIVE"; }>();
});
