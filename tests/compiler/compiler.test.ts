import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type {
    GetVariables,
    GraphQLInput,
    GetReturnType,
    GetSelectionType,
    IsValidGraphQL,
    ValidateGraphQL,
} from "../../src/index.js";

type UserId = string & { readonly __userId: unique symbol };

type Schema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {
                version: string;
            };
            Mutation: {
                ok: boolean;
            };
            User: {
                id: string;
                name: string | null;
            };
            Post: {
                id: string;
            };
        };
    };
    relations: {
        public: {
            Query: {
                user: {
                    type: "User";
                    nullable: true;
                };
            };
            User: {
                posts: {
                    type: "Post";
                    multiple: true;
                };
            };
        };
    };
    arguments: {
        public: {
            Query: {
                user: {
                    id: GraphQLInput<"ID!", UserId>;
                };
            };
        };
    };
};

type ConflictSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {
                id: string;
                name: string;
                version: string;
            };
        };
    };
};

type AdvancedSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {
                search: boolean;
                node: {};
                results: {};
            };
            Node: {
                id: string;
            };
            SearchResult: {};
            User: {
                id: string;
                name: string;
            };
            Post: {
                id: string;
                title: number;
            };
        };
    };
    relations: {
        public: {
            Query: {
                node: {
                    type: "Node";
                    nullable: true;
                };
                results: {
                    type: "SearchResult";
                    multiple: true;
                };
            };
            User: {
                counterpart: {
                    type: "Post";
                    nullable: true;
                };
                counterparts: {
                    type: "Post";
                    multiple: true;
                };
            };
            Post: {
                counterpart: {
                    type: "User";
                    nullable: true;
                };
                counterparts: {
                    type: "User";
                    nullable: true;
                };
            };
        };
    };
    arguments: {
        public: {
            Query: {
                search: {
                    filter: GraphQLInput<"SearchFilter">;
                };
            };
        };
    };
    inputs: {
        public: {
            SearchFilter: {
                ids: GraphQLInput<"[ID!]!">;
                nested: GraphQLInput<"NestedFilter">;
                status: GraphQLInput<"Status">;
            };
            NestedFilter: {
                limit: GraphQLInput<"Int">;
            };
        };
    };
    enums: {
        public: {
            Status: "OPEN" | "CLOSED";
        };
    };
    interfaces: {
        public: {
            Node: {
                possibleTypes: "User" | "Post";
            };
        };
    };
    unions: {
        public: {
            SearchResult: {
                possibleTypes: "User" | "Post";
            };
        };
    };
    directives: {
        public: {
            client: {
                arguments: {
                    flag: GraphQLInput<"Boolean!">;
                    filter: GraphQLInput<"SearchFilter">;
                };
                locations: "FIELD";
            };
            operationTag: {
                arguments: {
                    flag: GraphQLInput<"Boolean!">;
                };
                locations: "QUERY";
            };
            fragmentTag: {
                arguments: {
                    flag: GraphQLInput<"Boolean!">;
                };
                locations: "FRAGMENT_DEFINITION";
            };
            varTag: {
                arguments: {
                    reason: GraphQLInput<"String!">;
                };
                locations: "VARIABLE_DEFINITION";
            };
        };
    };
};

test("direct compiler infers fields, aliases, relations, and nullability", () => {
    type Result = GetReturnType<
        'query Q($id: ID!) { apiVersion: version user(id: $id) { id name posts { id } } }',
        Schema
    >;

    expectTypeOf<Result>().toEqualTypeOf<{
        apiVersion: string;
        user: {
            id: string;
            name: string | null;
            posts: { id: string }[];
        } | null;
    }>();
});

test("direct compiler validates schema selections", () => {
    expectTypeOf<IsValidGraphQL<"{ version }", Schema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<IsValidGraphQL<"{ missing }", Schema>>()
        .toEqualTypeOf<false>();
    expectTypeOf<ValidateGraphQL<'query Q($id: ID!) { user(id: $id) }', Schema>>()
        .toMatchTypeOf<{ code: "MISSING_SELECTION"; }>();
});

test("partial selections share the same compiler", () => {
    expectTypeOf<GetSelectionType<"id posts { id }", Schema, "User">>()
        .toEqualTypeOf<{ id: string; posts: { id: string }[] }>();
});

test("fragments compile without an AST", () => {
    type Result = GetReturnType<
        "query Q($id: ID!) { user(id: $id) { ...UserFields } } fragment UserFields on User { id name }",
        Schema,
        "Q"
    >;
    expectTypeOf<Result>().toEqualTypeOf<{
        user: { id: string; name: string | null } | null;
    }>();
});

test("arguments and variables are validated and inferred in the same pass", () => {
    type Query = "query User($id: ID!) { user(id: $id) { id } }";

    expectTypeOf<GetVariables<Query, Schema>>()
        .toEqualTypeOf<{ id: UserId }>();
    expectTypeOf<IsValidGraphQL<Query, Schema>>().toEqualTypeOf<true>();
    expectTypeOf<
        ValidateGraphQL<'query Q { user(id: "raw") { id } }', Schema>
    >().toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
    expectTypeOf<
        ValidateGraphQL<"query Q { user { id } }", Schema>
    >().toMatchTypeOf<{ code: "MISSING_REQUIRED_ARGUMENT"; }>();
});

test("a variable used at multiple branded positions intersects their application types", () => {
    type UserId = string & { readonly __brand: "User" };
    type PostId = string & { readonly __brand: "Post" };

    type BrandSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                Query: { version: string; pick: string };
                User: { id: UserId };
                Post: { id: PostId };
            };
        };
        relations: {
            public: {
                Query: {
                    user: { type: "User"; nullable: true };
                    post: { type: "Post"; nullable: true };
                };
            };
        };
        arguments: {
            public: {
                Query: {
                    user: { id: GraphQLInput<"ID!", UserId> };
                    post: { id: GraphQLInput<"ID!", PostId> };
                    pick: { kind: GraphQLInput<"Kind!", "a" | "b"> };
                };
            };
        };
    };

    // The single runtime value flows into both a UserId and a PostId position,
    // so it must satisfy both — the intersection, not the union (a UserId must
    // not be silently acceptable where a PostId is expected).
    type SharedVar =
        "query Q($id: ID!) { user(id: $id) { id } post(id: $id) { id } }";
    expectTypeOf<GetVariables<SharedVar, BrandSchema>>()
        .toEqualTypeOf<{ id: UserId & PostId }>();

    // A union that lives inside a single use's application type must be
    // preserved as a union, not collapsed by the cross-use intersection.
    type SingleUnionUse = "query Q($k: Kind!) { pick(kind: $k) }";
    expectTypeOf<GetVariables<SingleUnionUse, BrandSchema>>()
        .toEqualTypeOf<{ k: "a" | "b" }>();
});

test("directive variables are collected and unused variables are rejected", () => {
    type Query = "query Q($show: Boolean!) { version @include(if: $show) }";

    expectTypeOf<GetVariables<Query, Schema>>()
        .toEqualTypeOf<{ show: boolean }>();
    expectTypeOf<IsValidGraphQL<Query, Schema>>().toEqualTypeOf<true>();
    expectTypeOf<
        ValidateGraphQL<"query Q($unused: Boolean!) { version }", Schema>
    >().toMatchTypeOf<{ code: "UNUSED_VARIABLE"; }>();
});

test("a field selected unconditionally and under @include stays required", () => {
    type Query =
        "query Q($show: Boolean!) { version version @include(if: $show) }";
    expectTypeOf<GetReturnType<Query, Schema>>()
        .toEqualTypeOf<{ version: string; }>();

    type OnlyConditional =
        "query Q($show: Boolean!) { version @include(if: $show) }";
    expectTypeOf<GetReturnType<OnlyConditional, Schema>>()
        .toEqualTypeOf<{ version?: string; }>();
});

test("variable defaults are validated against declared input types", () => {
    type NullableWithDefault =
        'query Q($flag: Boolean = true) { search(filter: { ids: ["1"] }) @client(flag: $flag) }';

    expectTypeOf<IsValidGraphQL<NullableWithDefault, AdvancedSchema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<GetVariables<NullableWithDefault, AdvancedSchema>>()
        .toEqualTypeOf<{ flag?: boolean; }>();

    type InputObjectDefault =
        'query Q($filter: SearchFilter = { ids: ["1", 2] nested: { limit: 3 } status: OPEN }) { search(filter: $filter) }';

    expectTypeOf<IsValidGraphQL<InputObjectDefault, AdvancedSchema>>()
        .toEqualTypeOf<true>();

    expectTypeOf<
        ValidateGraphQL<
            'query Q($flag: Boolean = "yes") { search(filter: { ids: ["1"] }) @client(flag: $flag) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();

    expectTypeOf<
        ValidateGraphQL<
            'query Q($filter: SearchFilter = { ids: [false] }) { search(filter: $filter) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();

    expectTypeOf<
        ValidateGraphQL<
            'query Q($status: Status = PENDING) { search(filter: { ids: ["1"] status: $status }) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();

    expectTypeOf<
        ValidateGraphQL<
            'query Q($flag: Boolean = null) { search(filter: { ids: ["1"] }) @client(flag: $flag) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "INVALID_VARIABLE_TYPE"; }>();

    expectTypeOf<
        ValidateGraphQL<
            'query Q($fallback: Boolean!, $flag: Boolean = $fallback) { search(filter: { ids: ["1"] }) @client(flag: $flag) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "SYNTAX_ERROR"; }>();
});

test("concrete fragments must apply to the current type", () => {
    expectTypeOf<
        IsValidGraphQL<
            "query Q($id: ID!) { user(id: $id) { ...UserFields } } fragment UserFields on User { id }",
            Schema
        >
    >().toEqualTypeOf<true>();

    expectTypeOf<
        ValidateGraphQL<
            "query Q($id: ID!) { user(id: $id) { ...PostFields } } fragment PostFields on Post { id }",
            Schema
        >
    >().toMatchTypeOf<{ code: "FRAGMENT_TYPE_MISMATCH"; }>();

    expectTypeOf<
        ValidateGraphQL<
            "query Q($id: ID!) { user(id: $id) { ... on Post { id } } }",
            Schema
        >
    >().toMatchTypeOf<{ code: "FRAGMENT_TYPE_MISMATCH"; }>();
});

test("conflicting duplicate response keys are rejected", () => {
    expectTypeOf<
        IsValidGraphQL<"{ id id }", ConflictSchema>
    >().toEqualTypeOf<true>();

    expectTypeOf<
        ValidateGraphQL<"{ same: id same: name }", ConflictSchema>
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();
});

test("duplicate selections of the same field merge their sub-selections", () => {
    type Dup =
        "query Q($id: ID!) { user(id: $id) { id } user(id: $id) { name } }";

    expectTypeOf<IsValidGraphQL<Dup, Schema>>().toEqualTypeOf<true>();
    expectTypeOf<GetReturnType<Dup, Schema>>().toEqualTypeOf<{
        user: { id: string; name: string | null } | null;
    }>();

    type Nested =
        "query Q($id: ID!) { user(id: $id) { posts { a: id } } user(id: $id) { posts { b: id } } }";

    expectTypeOf<IsValidGraphQL<Nested, Schema>>().toEqualTypeOf<true>();
    expectTypeOf<GetReturnType<Nested, Schema>>().toEqualTypeOf<{
        user: { posts: { a: string; b: string }[] } | null;
    }>();

    type ViaFragment =
        "query Q($id: ID!) { user(id: $id) { id } ...Extra } fragment Extra on Query { user(id: $id) { name } }";

    expectTypeOf<GetReturnType<ViaFragment, Schema>>().toEqualTypeOf<{
        user: { id: string; name: string | null } | null;
    }>();

    expectTypeOf<
        ValidateGraphQL<
            "query Q($id: ID!) { user(id: $id) { same: id } user(id: $id) { same: name } }",
            Schema
        >
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();

    expectTypeOf<
        ValidateGraphQL<
            "query Q($a: ID!, $b: ID!) { user(id: $a) { id } user(id: $b) { id } }",
            Schema
        >
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();
});

test("multi-operation documents require an operation name", () => {
    expectTypeOf<
        IsValidGraphQL<"query A { version } query B { version }", Schema>
    >().toEqualTypeOf<false>();

    expectTypeOf<
        GetReturnType<
            "query A { version } query B { apiVersion: version }",
            Schema,
            "B"
        >
    >().toEqualTypeOf<{ apiVersion: string }>();
});

test("nested input object and list literals are validated recursively", () => {
    expectTypeOf<
        IsValidGraphQL<
            '{ search(filter: { ids: ["1", 2] nested: { limit: 3 } status: OPEN }) }',
            AdvancedSchema
        >
    >().toEqualTypeOf<true>();

    expectTypeOf<
        ValidateGraphQL<
            '{ search(filter: { ids: ["1", false] }) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();

    expectTypeOf<
        ValidateGraphQL<
            '{ search(filter: { nested: { limit: 3 } }) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "MISSING_REQUIRED_ARGUMENT"; }>();

    expectTypeOf<
        ValidateGraphQL<
            '{ search(filter: { ids: ["1"] extra: true }) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "UNKNOWN_ARGUMENT"; }>();

    expectTypeOf<
        ValidateGraphQL<
            '{ search(filter: { ids: ["1"] status: PENDING }) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
});

test("custom directive metadata validates arguments and locations", () => {
    type Query =
        'query Q($flag: Boolean!) { search(filter: { ids: ["1"] }) @client(flag: $flag, filter: { ids: ["2"] }) }';

    expectTypeOf<IsValidGraphQL<Query, AdvancedSchema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<GetVariables<Query, AdvancedSchema>>()
        .toEqualTypeOf<{ flag: boolean }>();

    expectTypeOf<
        ValidateGraphQL<'{ search(filter: { ids: ["1"] }) @client }', AdvancedSchema>
    >().toMatchTypeOf<{ code: "MISSING_REQUIRED_ARGUMENT"; }>();

    expectTypeOf<
        ValidateGraphQL<
            '{ search(filter: { ids: ["1"] }) @client(flag: true, unknown: false) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "UNKNOWN_ARGUMENT"; }>();

    expectTypeOf<
        ValidateGraphQL<
            'query Q { results { ... on User @client(flag: true) { name } } }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "INVALID_DIRECTIVE_LOCATION"; }>();

    type DocumentDirectiveQuery =
        'query Q($flag: Boolean!) @operationTag(flag: $flag) { node { ...NodeFields } } fragment NodeFields on Node @fragmentTag(flag: $flag) { id }';

    expectTypeOf<IsValidGraphQL<DocumentDirectiveQuery, AdvancedSchema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<GetVariables<DocumentDirectiveQuery, AdvancedSchema>>()
        .toEqualTypeOf<{ flag: boolean }>();

    expectTypeOf<
        ValidateGraphQL<
            'query Q @operationTag { search(filter: { ids: ["1"] }) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "MISSING_REQUIRED_ARGUMENT"; }>();

    expectTypeOf<
        ValidateGraphQL<
            'query Q @client(flag: true) { search(filter: { ids: ["1"] }) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "INVALID_DIRECTIVE_LOCATION"; }>();

    expectTypeOf<
        IsValidGraphQL<
            'query Q($flag: Boolean! @varTag(reason: "test")) { search(filter: { ids: ["1"] }) @client(flag: $flag) }',
            AdvancedSchema
        >
    >().toEqualTypeOf<true>();

    expectTypeOf<
        ValidateGraphQL<
            'query Q($flag: Boolean! @varTag) { search(filter: { ids: ["1"] }) @client(flag: $flag) }',
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "MISSING_REQUIRED_ARGUMENT"; }>();
});

test("interfaces, unions, and abstract fragment overlaps are validated", () => {
    expectTypeOf<
        GetReturnType<
            "{ node { id ... on User { name } } }",
            AdvancedSchema
        >
    >().toEqualTypeOf<{
        node: {
            id: string;
            name?: string;
        } | null;
    }>();

    expectTypeOf<
        ValidateGraphQL<
            "{ results { ... on User { same: name } ... on Post { same: title } } }",
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();

    expectTypeOf<
        IsValidGraphQL<
            "{ results { ... on User { same: name } ... on Post { same: id } } }",
            AdvancedSchema
        >
    >().toEqualTypeOf<true>();

    expectTypeOf<
        ValidateGraphQL<
            "{ results { ... on User { c: counterpart { x: title } } ... on Post { c: counterpart { x: name } } } }",
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();

    expectTypeOf<
        IsValidGraphQL<
            "{ results { ... on User { c: counterpart { x: id } } ... on Post { c: counterpart { x: id } } } }",
            AdvancedSchema
        >
    >().toEqualTypeOf<true>();

    expectTypeOf<
        ValidateGraphQL<
            "{ results { ... on User { c: counterparts { id } } ... on Post { c: counterparts { id } } } }",
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();

    expectTypeOf<
        ValidateGraphQL<
            "{ results { ... on User { same: id same: name } } }",
            AdvancedSchema
        >
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();

    expectTypeOf<
        IsValidGraphQL<
            "query Q { node { ...UserFields } } fragment UserFields on User { name }",
            AdvancedSchema
        >
    >().toEqualTypeOf<true>();
});
