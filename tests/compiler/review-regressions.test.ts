// Regressions from the 2026-09 review. Each test pins behaviour that used to
// be wrong: see CHANGELOG for the user-facing description of each fix.

import { test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type {
    GetReturnType,
    GetVariables,
    GraphQLInput,
    ValidateGraphQL,
} from "../../src/index.js";

type UserId = string & { readonly __brand: "User"; };

type Schema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: { version: string; };
            User: { id: string; name: string | null; };
            Post: { id: string; title: string; };
            Node: { id: string; };
        };
    };
    relations: {
        public: {
            Query: {
                node: { type: "Node"; nullable: true; };
                user: { type: "User"; nullable: true; };
                users: { type: "User"; multiple: true; };
            };
            Node: { owner: { type: "User"; }; };
            User: { owner: { type: "User"; }; };
            Post: { owner: { type: "User"; }; };
        };
    };
    arguments: {
        public: {
            Query: {
                user: {
                    id: GraphQLInput<"ID!">;
                    ids: GraphQLInput<"[Int]">;
                    since: GraphQLInput<"timestamptz", string>;
                    at: GraphQLInput<"timestamptz">;
                    owner: GraphQLInput<"uuid", UserId>;
                    tags: GraphQLInput<"[String!]">;
                };
                users: { limit: GraphQLInput<"Int!">; };
            };
        };
    };
    interfaces: { public: { Node: { possibleTypes: "User" | "Post"; }; }; };
};

test("custom scalar literals validate against the argument's app type when the schema has no scalars section", () => {
    // Fits the declared `string` app type.
    expectTypeOf<
        ValidateGraphQL<
            `query { user(id: "1", since: "2024-01-01") { id } }`,
            Schema
        >
    >().toEqualTypeOf<true>();
    // Wrong primitive for the declared app type.
    expectTypeOf<
        ValidateGraphQL<`query { user(id: "1", since: 42) { id } }`, Schema>
    >().toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
    // No app type declared (`unknown`): any literal is accepted.
    expectTypeOf<
        ValidateGraphQL<`query { user(id: "1", at: 42) { id } }`, Schema>
    >().toEqualTypeOf<true>();
    // Branded app type: a literal cannot carry the brand, same rule as ID!.
    expectTypeOf<
        ValidateGraphQL<`query { user(id: "1", owner: "u1") { id } }`, Schema>
    >().toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
    expectTypeOf<
        ValidateGraphQL<
            `query Q($o: uuid!) { user(id: "1", owner: $o) { id } }`,
            Schema
        >
    >().toEqualTypeOf<true>();
});

test("a nested field at interface level merges with its type-conditioned duplicate", () => {
    type Q = `query { node { owner { id } ... on User { owner { name } } } }`;
    expectTypeOf<ValidateGraphQL<Q, Schema>>().toEqualTypeOf<true>();
    // `id` is selected for every runtime type; `name` only for User.
    expectTypeOf<GetReturnType<Q, Schema>>().toEqualTypeOf<{
        node: { owner: { id: string; name?: string | null; }; } | null;
    }>();

    // Disjoint conditions stay separate union members.
    type Disjoint =
        `query { node { ... on User { owner { id } } ... on Post { owner { name } } } }`;
    expectTypeOf<GetReturnType<Disjoint, Schema>>().toEqualTypeOf<{
        node: { owner?: { id: string; } | { name: string | null; }; } | null;
    }>();
});

test("a nullable variable with a default that feeds a non-null argument does not accept null", () => {
    type Q = `query Q($limit: Int = 5) { users(limit: $limit) { id } }`;
    expectTypeOf<ValidateGraphQL<Q, Schema>>().toEqualTypeOf<true>();
    expectTypeOf<GetVariables<Q, Schema>>().toEqualTypeOf<
        { limit?: number; }
    >();

    // Used only at a nullable position, null stays allowed.
    type Nullable =
        `query Q($ids: [Int] = [1]) { user(id: "1", ids: $ids) { id } }`;
    expectTypeOf<GetVariables<Nullable, Schema>>().toEqualTypeOf<{
        ids?: (number | null)[] | null;
    }>();
});

test("duplicate fields differing only in whitespace around a backslash-terminated string merge", () => {
    type Q =
        `query { user(id: "1", tags: ["x\\\\" , "y"]) { id } user(id: "1", tags: ["x\\\\", "y"]) { id } }`;
    expectTypeOf<ValidateGraphQL<Q, Schema>>().toEqualTypeOf<true>();

    // A quote inside a comment is not a string delimiter either.
    type Commented = `query {
        user(id: "1", tags: ["x" # it's "quoted"
        , "y"]) { id }
        user(id: "1", tags: ["x", "y"]) { id }
    }`;
    expectTypeOf<ValidateGraphQL<Commented, Schema>>().toEqualTypeOf<true>();

    // Genuinely different lists still conflict.
    type Different =
        `query { user(id: "1", tags: ["x"]) { id } user(id: "1", tags: ["y"]) { id } }`;
    expectTypeOf<ValidateGraphQL<Different, Schema>>().toMatchTypeOf<{
        code: "FIELD_CONFLICT";
    }>();
});

test("list item nullability is kept in inferred variables", () => {
    type Q = `query Q($ids: [Int]) { user(id: "1", ids: $ids) { id } }`;
    expectTypeOf<GetVariables<Q, Schema>>().toEqualTypeOf<{
        ids?: (number | null)[] | null;
    }>();
    type NonNullItems =
        `query Q($tags: [String!]) { user(id: "1", tags: $tags) { id } }`;
    expectTypeOf<GetVariables<NonNullItems, Schema>>().toEqualTypeOf<{
        tags?: string[] | null;
    }>();
    // A variable used as a list item keeps its own nullability.
    type Item = `query Q($x: Int!) { user(id: "1", ids: [$x, null]) { id } }`;
    expectTypeOf<GetVariables<Item, Schema>>().toEqualTypeOf<{ x: number; }>();
});
