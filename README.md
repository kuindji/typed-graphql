# @kuindji/typed-graphql

**Compile-time GraphQL validation, variables inference, and result-type inference for TypeScript.**

You write a GraphQL query as a normal TypeScript string. The library checks it
against a schema type while `tsc` runs and infers both:

- the returned data shape; and
- the runtime variables object.

The core is intentionally AST-less. It uses a strict shallow compiler that walks
the source string directly, validates only the selected operation plus referenced
fragments, and returns structured `GraphQLError` diagnostics for invalid input.
Nothing runs at runtime for validation or inference.

This is a sibling of [`@kuindji/typed-sql`](https://github.com/kuindji/typed-sql),
using the same bias toward type-level performance: direct source walks, bounded
chunking, no token-array materialization, and no public AST layer.

## Public API

```ts
import type {
    GetReturnType,
    GetSelectionType,
    GetVariables,
    GraphQLInput,
    GraphQLSchema,
    IsValidGraphQL,
    ValidateGraphQL,
    ValidateSelection,
} from "@kuindji/typed-graphql";

type UserId = string & { readonly __table: "User" };

type Schema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {
                version: string;
            };
            User: {
                id: UserId;
                email: string | null;
            };
        };
    };
    relations: {
        public: {
            Query: {
                user: { type: "User"; nullable: true };
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

type Query = `query User($id: ID!) {
    user(id: $id) {
        id
        email
    }
}`;

type Valid = ValidateGraphQL<Query, Schema>; // true
type IsValid = IsValidGraphQL<Query, Schema>; // true
type Data = GetReturnType<Query, Schema>; // { user: { id: UserId; email: string | null } | null }
type Variables = GetVariables<Query, Schema>; // { id: UserId }

type Partial = GetSelectionType<"id email", Schema, "User">;
type PartialValid = ValidateSelection<"id email", Schema, "User">;
```

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

The roadmap and design constraints are in [GOALS.md](./GOALS.md).

## License

[MIT](./LICENSE) © Ivan Kuindzhi
