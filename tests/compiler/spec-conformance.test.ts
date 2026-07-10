import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type {
    GetReturnType,
    GetVariables,
    GraphQLInput,
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
                echo: string;
            };
            User: {
                id: string;
                name: string | null;
            };
            Post: {
                id: string;
                title: number;
            };
            Node: {
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
                node: {
                    type: "Node";
                    nullable: true;
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
                echo: {
                    text: GraphQLInput<"String">;
                    count: GraphQLInput<"Int">;
                    ids: GraphQLInput<"[ID!]", UserId[]>;
                    tags: GraphQLInput<"[ID]">;
                    when: GraphQLInput<"DateTime">;
                };
            };
        };
    };
    scalars: {
        public: {
            DateTime: string;
        };
    };
    interfaces: {
        public: {
            Node: {
                possibleTypes: "User" | "Post";
            };
        };
    };
    directives: {
        public: {
            check: {
                arguments: {
                    when: GraphQLInput<"Boolean">;
                };
                locations: "VARIABLE_DEFINITION";
            };
            trace: {
                arguments: {
                    tag: GraphQLInput<"String">;
                };
                locations: "FIELD";
            };
            tag: {
                arguments: {
                    name: GraphQLInput<"String">;
                };
                locations: "FIELD";
                repeatable: true;
            };
        };
    };
};

test("a second variable definition list is a syntax error", () => {
    type TwoLists = "query Q($a: ID!)($id: ID!) { user(id: $id) { id } }";

    expectTypeOf<IsValidGraphQL<TwoLists, Schema>>().toEqualTypeOf<false>();
    expectTypeOf<ValidateGraphQL<TwoLists, Schema>>()
        .toMatchTypeOf<{ code: "SYNTAX_ERROR"; }>();
});

test("inline fragments may omit the type condition", () => {
    expectTypeOf<GetReturnType<"{ ... { version } }", Schema>>()
        .toEqualTypeOf<{ version: string }>();

    type Conditional =
        "query Q($show: Boolean!) { ... @include(if: $show) { version } }";

    expectTypeOf<GetVariables<Conditional, Schema>>()
        .toEqualTypeOf<{ show: boolean }>();
    expectTypeOf<GetReturnType<Conditional, Schema>>()
        .toEqualTypeOf<{ version?: string }>();
});

test("list variables with stricter item nullability are compatible", () => {
    expectTypeOf<
        IsValidGraphQL<"query Q($ids: [ID!]) { echo(tags: $ids) }", Schema>
    >().toEqualTypeOf<true>();

    expectTypeOf<
        IsValidGraphQL<"query Q($ids: [ID!]!) { echo(tags: $ids) }", Schema>
    >().toEqualTypeOf<true>();

    expectTypeOf<
        ValidateGraphQL<"query Q($ids: [ID]) { echo(ids: $ids) }", Schema>
    >().toMatchTypeOf<{ code: "INVALID_VARIABLE_TYPE"; }>();
});

test("custom scalar literals validate against the schema scalars map", () => {
    expectTypeOf<IsValidGraphQL<'{ echo(when: "2024-01-01") }', Schema>>()
        .toEqualTypeOf<true>();

    expectTypeOf<ValidateGraphQL<"{ echo(when: 123) }", Schema>>()
        .toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
    expectTypeOf<ValidateGraphQL<"{ echo(when: banana) }", Schema>>()
        .toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();

    expectTypeOf<
        IsValidGraphQL<
            'query Q($d: DateTime = "2024-01-01") { echo(when: $d) }',
            Schema
        >
    >().toEqualTypeOf<true>();
});

test("__typename meta-field resolves to the possible runtime type names", () => {
    expectTypeOf<GetReturnType<"{ __typename version }", Schema>>()
        .toEqualTypeOf<{ __typename: "Query"; version: string }>();

    expectTypeOf<GetReturnType<"{ node { __typename id } }", Schema>>()
        .toEqualTypeOf<{
            node: { __typename: "User" | "Post"; id: string } | null;
        }>();
});

test("an anonymous operation must be the only operation in the document", () => {
    type Mixed = "{ version } query Q { version }";

    expectTypeOf<IsValidGraphQL<Mixed, Schema, "Q">>().toEqualTypeOf<false>();
    expectTypeOf<ValidateGraphQL<Mixed, Schema, "Q">>()
        .toMatchTypeOf<{ code: "LONE_ANONYMOUS_OPERATION"; }>();
});

test("field conflicts compare string arguments by exact content", () => {
    expectTypeOf<
        ValidateGraphQL<'{ same: echo(text: "x y") same: echo(text: "xy") }', Schema>
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();

    expectTypeOf<
        IsValidGraphQL<'{ same: echo(text: "x y") same: echo( text: "x y" ) }', Schema>
    >().toEqualTypeOf<true>();
});

test("field conflicts compare argument lists structurally", () => {
    expectTypeOf<
        IsValidGraphQL<
            '{ same: echo(text: "a", count: 1) same: echo(count: 1, text: "a") }',
            Schema
        >
    >().toEqualTypeOf<true>();

    expectTypeOf<
        IsValidGraphQL<
            "query Q($id: ID!) { user(id: $id # key\n) { id } user(id: $id) { id } }",
            Schema
        >
    >().toEqualTypeOf<true>();

    expectTypeOf<
        ValidateGraphQL<'{ same: echo(text: "a") same: echo(text: "b") }', Schema>
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();

    expectTypeOf<
        ValidateGraphQL<
            '{ same: echo(text: "a", count: 1) same: echo(text: "a", count: 2) }',
            Schema
        >
    >().toMatchTypeOf<{ code: "FIELD_CONFLICT"; }>();
});

test("int literals coerce to ID but not to String", () => {
    expectTypeOf<ValidateGraphQL<"{ echo(text: 123) }", Schema>>()
        .toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
    expectTypeOf<IsValidGraphQL<"{ echo(tags: [1, 2]) }", Schema>>()
        .toEqualTypeOf<true>();
});

test("variables inside list literals keep the argument's branded type", () => {
    type Query = "query Q($one: ID!) { echo(ids: [$one]) }";

    expectTypeOf<IsValidGraphQL<Query, Schema>>().toEqualTypeOf<true>();
    expectTypeOf<GetVariables<Query, Schema>>()
        .toEqualTypeOf<{ one: UserId }>();
});

test("a nullable variable accepts an explicit null value", () => {
    type Query = "query Q($note: String) { echo(text: $note) }";

    expectTypeOf<IsValidGraphQL<Query, Schema>>().toEqualTypeOf<true>();
    expectTypeOf<GetVariables<Query, Schema>>()
        .toEqualTypeOf<{ note?: string | null; }>();
});

test("comments end at a lone carriage return, not only at newline", () => {
    expectTypeOf<IsValidGraphQL<"# lead\r{ version }", Schema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<IsValidGraphQL<"{ version # trailing\r echo }", Schema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<IsValidGraphQL<"{ version # crlf\r\n echo }", Schema>>()
        .toEqualTypeOf<true>();
});

test('block strings treat \\""" as an escaped triple-quote', () => {
    expectTypeOf<
        IsValidGraphQL<'{ echo(text: """say \\"""hi\\""" done""") }', Schema>
    >().toEqualTypeOf<true>();
});

test("variable definition directives require constant arguments", () => {
    type ConstViolation =
        "query Q($flag: Boolean! = true @check(when: $flag)) { version }";

    expectTypeOf<IsValidGraphQL<ConstViolation, Schema>>()
        .toEqualTypeOf<false>();
    expectTypeOf<ValidateGraphQL<ConstViolation, Schema>>()
        .toMatchTypeOf<{ code: "SYNTAX_ERROR"; }>();

    type ConstOk =
        "query Q($flag: Boolean! @check(when: true)) { ... @include(if: $flag) { version } }";

    expectTypeOf<IsValidGraphQL<ConstOk, Schema>>().toEqualTypeOf<true>();
});

test("directive argument lists cannot be empty", () => {
    expectTypeOf<ValidateGraphQL<"{ version @trace() }", Schema>>()
        .toMatchTypeOf<{ code: "SYNTAX_ERROR"; }>();

    expectTypeOf<IsValidGraphQL<'{ version @trace(tag: "x") }', Schema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<IsValidGraphQL<"{ version @trace }", Schema>>()
        .toEqualTypeOf<true>();
});

test("non-repeatable directives cannot be duplicated at one location", () => {
    // Built-in @include is non-repeatable (spec §5.7.3).
    expectTypeOf<
        ValidateGraphQL<
            "query Q($s: Boolean!) { version @include(if: $s) @include(if: $s) }",
            Schema
        >
    >().toMatchTypeOf<{ code: "DUPLICATE_DIRECTIVE"; }>();

    // A schema directive without `repeatable` is likewise unique per location.
    expectTypeOf<
        ValidateGraphQL<'{ version @trace(tag: "a") @trace(tag: "b") }', Schema>
    >().toMatchTypeOf<{ code: "DUPLICATE_DIRECTIVE"; }>();

    // Distinct directives at one location are allowed.
    expectTypeOf<
        IsValidGraphQL<
            'query Q($s: Boolean!) { version @include(if: $s) @trace(tag: "a") }',
            Schema
        >
    >().toEqualTypeOf<true>();

    // A directive declared repeatable may appear more than once.
    expectTypeOf<
        IsValidGraphQL<'{ version @tag(name: "a") @tag(name: "b") }', Schema>
    >().toEqualTypeOf<true>();
});

test("Int literals outside the 32-bit signed range are rejected", () => {
    // In-range boundaries are accepted.
    expectTypeOf<IsValidGraphQL<"{ echo(count: 2147483647) }", Schema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<IsValidGraphQL<"{ echo(count: -2147483648) }", Schema>>()
        .toEqualTypeOf<true>();
    expectTypeOf<IsValidGraphQL<"{ echo(count: 0) }", Schema>>()
        .toEqualTypeOf<true>();

    // One past each boundary is out of range (spec §3.5.1).
    expectTypeOf<ValidateGraphQL<"{ echo(count: 2147483648) }", Schema>>()
        .toMatchTypeOf<{ code: "INT_OUT_OF_RANGE"; }>();
    expectTypeOf<ValidateGraphQL<"{ echo(count: -2147483649) }", Schema>>()
        .toMatchTypeOf<{ code: "INT_OUT_OF_RANGE"; }>();

    // Far out of range (more than ten digits) also rejected.
    expectTypeOf<ValidateGraphQL<"{ echo(count: 99999999999) }", Schema>>()
        .toMatchTypeOf<{ code: "INT_OUT_OF_RANGE"; }>();
});

test("defined fragments must be used (spec §5.5.1.4)", () => {
    // A fragment that is never spread anywhere is rejected...
    expectTypeOf<
        ValidateGraphQL<"{ version } fragment Unused on Query { version }", Schema>
    >().toMatchTypeOf<{ code: "UNUSED_FRAGMENT"; }>();

    // ...even when its type condition is bogus (previously passed silently).
    expectTypeOf<
        ValidateGraphQL<
            "{ version } fragment Broken on Nonexistent { whatever }",
            Schema
        >
    >().toMatchTypeOf<{ code: "UNUSED_FRAGMENT"; }>();

    // A spread fragment is still accepted.
    expectTypeOf<
        IsValidGraphQL<
            "query Q($id: ID!) { user(id: $id) { ...F } } fragment F on User { id name }",
            Schema
        >
    >().toEqualTypeOf<true>();

    // A fragment reached only through another fragment still counts as used.
    expectTypeOf<
        IsValidGraphQL<
            "query Q($id: ID!) { user(id: $id) { ...A } } fragment A on User { id ...B } fragment B on User { name }",
            Schema
        >
    >().toEqualTypeOf<true>();
});

test("a subscription must select exactly one root field", () => {
    type SubSchema = {
        defaultSchema: "public";
        schemas: {
            public: {
                Query: { version: string };
                Subscription: { tick: string; tock: string };
            };
        };
    };

    expectTypeOf<IsValidGraphQL<"subscription S { tick }", SubSchema>>()
        .toEqualTypeOf<true>();

    expectTypeOf<ValidateGraphQL<"subscription S { tick tock }", SubSchema>>()
        .toMatchTypeOf<{ code: "SUBSCRIPTION_MULTIPLE_ROOT_FIELDS"; }>();

    // Two response keys for the same field are still two root fields.
    expectTypeOf<
        ValidateGraphQL<"subscription S { a: tick b: tick }", SubSchema>
    >().toMatchTypeOf<{ code: "SUBSCRIPTION_MULTIPLE_ROOT_FIELDS"; }>();

    // Fields reached through a fragment spread count toward the root set.
    expectTypeOf<
        ValidateGraphQL<
            "subscription S { ...F } fragment F on Subscription { tick tock }",
            SubSchema
        >
    >().toMatchTypeOf<{ code: "SUBSCRIPTION_MULTIPLE_ROOT_FIELDS"; }>();
    expectTypeOf<
        IsValidGraphQL<
            "subscription S { ...F } fragment F on Subscription { tick }",
            SubSchema
        >
    >().toEqualTypeOf<true>();

    expectTypeOf<ValidateGraphQL<"subscription S { __typename }", SubSchema>>()
        .toMatchTypeOf<{ code: "SUBSCRIPTION_INTROSPECTION_ROOT"; }>();

    expectTypeOf<
        IsValidGraphQL<
            "subscription S { tick @include(if: true) }",
            SubSchema
        >
    >().toEqualTypeOf<true>();
    expectTypeOf<
        GetReturnType<
            "subscription S { tick @include(if: true) }",
            SubSchema
        >
    >().toEqualTypeOf<{ tick: string; }>();

    type ConditionalFragmentSubscription =
        "subscription S($show: Boolean!) { ...F @include(if: $show) } fragment F on Subscription { tick }";
    expectTypeOf<
        IsValidGraphQL<ConditionalFragmentSubscription, SubSchema>
    >().toEqualTypeOf<true>();
    expectTypeOf<
        GetReturnType<ConditionalFragmentSubscription, SubSchema>
    >().toEqualTypeOf<{ tick?: string; }>();

    // The same rule does not apply to queries.
    expectTypeOf<IsValidGraphQL<"{ version echo }", Schema>>()
        .toEqualTypeOf<true>();
});

test("bare-word literals are rejected for built-in scalar arguments", () => {
    expectTypeOf<ValidateGraphQL<"{ user(id: banana) { id } }", Schema>>()
        .toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
    expectTypeOf<ValidateGraphQL<"{ echo(text: banana) }", Schema>>()
        .toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
    expectTypeOf<ValidateGraphQL<"{ echo(count: banana) }", Schema>>()
        .toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
});
