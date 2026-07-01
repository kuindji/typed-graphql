# typed-graphql goals

## Purpose

`@kuindji/typed-graphql` provides compile-time GraphQL syntax checking, schema
validation, variables inference, and result-type inference for TypeScript string
literals.

The package is intended to make the useful type-level GraphQL behavior from
TheFloorr reusable, but the implementation is not a port of TheFloorr's AST
pipeline. The current direction follows the lessons from `@kuindji/typed-sql`:
walk the source string directly, avoid token arrays and public ASTs, and keep
the type-level work bounded.

The core model:

- consumers describe a schema as a TypeScript type;
- queries remain ordinary string literals;
- validation and inference happen in the TypeScript type system;
- no generated client or runtime schema is required for the core API;
- unsupported or malformed syntax returns a structured diagnostic instead of
  being silently accepted.

## Core public API

The public core provides:

```ts
type Validation = ValidateGraphQL<Query, Schema>;
type Valid = IsValidGraphQL<Query, Schema>;
type Result = GetReturnType<Query, Schema>;
type Variables = GetVariables<Query, Schema>;

type PartialValidation = ValidateSelection<Selection, Schema, "User">;
type PartialResult = GetSelectionType<Selection, Schema, "User">;
```

`ValidateGraphQL` returns `true` for a valid document or a branded
`GraphQLError` for the first invalid construct. `IsValidGraphQL` reduces that
to `true | false`. `GetReturnType` and `GetVariables` return `never` when the
query cannot compile.

There is intentionally no public `ParseGraphQL`/AST API. A full AST was useful
for early exploration, but it materially increases TypeScript instantiation
cost and depth pressure. The compiler keeps only the source slices it needs:
operation metadata, variable definitions, selection bodies, and fragment
bodies.

## Required language support

The first usable core must support:

- anonymous shorthand queries and named `query`, `mutation`, and `subscription`
  operations;
- operation selection by name when a document contains multiple operations;
- variables and variable type declarations;
- fields, arguments, aliases, nested selections, and relation nullability/list
  wrappers;
- named fragments and inline fragments;
- built-in `@skip` and `@include` result-shape effects;
- custom directives declared by the schema;
- scalar, object, list, enum, boolean, null, string, and numeric literal
  argument syntax;
- full-document and partial-selection entry points.

Unsupported constructs must fail with an explicit `GraphQLError` rather than
being ignored or widened silently. If a complexity cap is reached, the compiler
should return a diagnostic such as `QUERY_TOO_COMPLEX` rather than pretending
the query is valid.

## Schema model

The schema preserves the familiar `@kuindji/typed-sql` nesting for plain output
fields and adds separate metadata only where GraphQL requires it:

```ts
type UserId = string & { readonly __table: "User" };

type Schema = {
    defaultSchema: "public";

    schemas: {
        public: {
            Query: {};
            User: {
                id: UserId;
                email: string | null;
            };
            Post: {
                id: string;
                title: string;
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

    rootTypes?: {
        query: "Query";
        mutation: "Mutation";
        subscription: "Subscription";
    };

    inputs?: {};
    scalars?: {};
    enums?: {};
    interfaces?: {};
    unions?: {};
    directives?: {};
};
```

Object-valued fields live in `relations`. Relations are singular, non-null, and
have non-null items by default. Optional `multiple`, `nullable`, and
`itemNullable` flags express other GraphQL wrapping combinations.

Field arguments live in a general `arguments` map because scalar and
object-valued fields can both accept arguments.

GraphQL wire types and TypeScript application types are separate concerns:

```ts
type UserIdInput = GraphQLInput<"ID!", UserId>;
```

The first parameter describes GraphQL validation and coercion. The second
describes the TypeScript value the consumer must provide. This keeps branded
identifiers required at call sites even when their GraphQL wire representation
is a standard scalar. An inline GraphQL literal cannot prove a narrower
application type such as `UserId`, so strict validation must require a typed
variable for that argument.

## Compiler architecture

The type-level core is a strict shallow compiler:

1. Skip ignored GraphQL characters directly in the source string.
2. Index the document into operation and fragment entries without constructing
   token arrays or AST node trees.
3. Select the target operation.
4. Compile the selected operation body against the schema.
5. Compile referenced fragment bodies lazily in the current type context.
6. Validate arguments while collecting variable uses.
7. Resolve operation variable declarations into the runtime variables object.

Performance constraints are part of the design:

- do not materialize token arrays;
- do not build nested AST object trees;
- keep recursive workers chunked and resumable;
- accumulate field results as flat unions and materialize object shapes through
  mapped types;
- prefer direct source slices and structural delimiters over character-by-
  character work when possible;
- gate regressions with `npm run perf`.

## Runtime query building

Runtime query building is a later layer. The core must stay transport-neutral.
The builder should eventually provide:

- immutable builder state;
- operation and variable-definition assembly;
- typed request objects containing `document`, `variables`, optional
  `operationName`, and optional result path;
- an injected executor boundary.

Apollo ownership, authentication, retry/caching policy, error reporting, and
application lifecycle behavior remain consumer responsibilities.

## Delivery sequence

### Phase 1: AST-less core compiler

- Define `GraphQLSchema`, `GraphQLInput`, and branded diagnostics.
- Implement direct document indexing and selection compilation.
- Validate fields, relations, arguments, fragments, directives, operation
  roots, and variable declarations.
- Collect variables used in built-in directive arguments.
- Reject unused operation variable declarations.
- Reject impossible concrete fragment type conditions.
- Reject conflicting duplicate response keys.
- Infer result and variables types.
- Cover malformed syntax and schema errors with compile-time tests.
- Establish and maintain a TypeScript perf baseline.

### Phase 2: migration compatibility

- Recreate representative TheFloorr selections as package tests.
- Cover relations, nullable single relations, multiple relations, aggregates,
  and invalid field selections.
- Replace TheFloorr's local GraphQL type-level implementation with package
  exports without weakening type safety.

### Phase 3: runtime construction

- Extract reusable runtime builder helpers inside `typed-graphql`.
- Build a transport-independent typed request and executor boundary.
- Provide a stable Hasura builder based on TheFloorr's list, mutation,
  aggregate, and subscription behavior.

## Success criteria

The goals in this document are achieved when:

- equivalent partial selections infer the same or stricter result types than
  TheFloorr's current implementation;
- full GraphQL documents are validated and inferred against a documented schema
  type;
- invalid syntax and invalid schema selections produce stable, testable
  compile-time failures;
- full-document arguments and variables are validated, and the runtime variable
  object preserves application types such as branded identifiers;
- the core has no runtime or application-framework dependency;
- TypeScript perf remains bounded under the recorded budget;
- runtime construction lives inside `typed-graphql` without owning transport or
  application lifecycle concerns.
