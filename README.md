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

## Runtime construction

The core stays type-only. Runtime query building ships as separate entries:

- `@kuindji/typed-graphql/runtime` — the transport-neutral boundary:
  `GraphQLRequest`, `GraphQLExecutor`, `extractResult`, and document
  assembly helpers. You inject an executor that owns transport,
  authentication, retry, and error reporting. `execute` resolves a
  `{ data, error }` envelope: `data` is the response's root data object,
  and `error` — surfaced to call-sites through the builder's `response()`
  — is set when the operation failed. `unwrapResponse` turns a standard
  `{ data, errors }` envelope into root data, throwing
  `GraphQLResponseError` when the response carries errors
  (`extractErrors` reads the list without throwing):

  ```ts
  // Lenient: report the error out-of-band, let the call-site branch on it.
  const executor = {
      execute: async (request) => {
          const response = await post(request);
          return {
              data: (response as { data?: unknown; }).data ?? null,
              error: extractErrors(response)[0],
          };
      },
  };

  // Strict: reject the promise as soon as the response carries errors.
  const strictExecutor = {
      execute: async (request) => ({
          data: unwrapResponse(await post(request)),
      }),
  };
  ```
- `@kuindji/typed-graphql/hasura` — an immutable, chainable Hasura builder
  typed by the same schema:

```ts
import { createHasuraClient } from "@kuindji/typed-graphql/hasura";

const client = createHasuraClient<Schema>()({
    executor: { execute: async (request) => runRequestSomehow(request) },
    primaryKeys: { User: "id" },
    defaultSelections: { User: "id email" },
});

const users = await client.table("User").eq("email", "a@b.c").limit(10);
const one = await client.table("User").id(userId).one();
const count = await client.table("User").count();
```

## Development

See [CONTRIBUTING.md](./CONTRIBUTING.md).

The roadmap and design constraints are in [GOALS.md](./GOALS.md).

## License

[MIT](./LICENSE) © Ivan Kuindzhi
