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

test("bare-word literals are rejected for built-in scalar arguments", () => {
    expectTypeOf<ValidateGraphQL<"{ user(id: banana) { id } }", Schema>>()
        .toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
    expectTypeOf<ValidateGraphQL<"{ echo(text: banana) }", Schema>>()
        .toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
    expectTypeOf<ValidateGraphQL<"{ echo(count: banana) }", Schema>>()
        .toMatchTypeOf<{ code: "INVALID_ARGUMENT_VALUE"; }>();
});
