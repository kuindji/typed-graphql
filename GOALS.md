# typed-graphql goals

## Purpose

`@kuindji/typed-graphql` will provide compile-time GraphQL parsing,
schema validation, and result-type inference for TypeScript string literals.
It is intended to replace the type-level GraphQL implementation currently in
TheFloorr's `packages/common/src/graphql` and make that functionality reusable
outside TheFloorr.

The library should follow the same general model as `@kuindji/typed-sql`:

- consumers describe a schema as a TypeScript type;
- queries remain ordinary string literals;
- parsing, validation, and result inference happen in the TypeScript type
  system;
- no generated client or runtime schema is required for the core type-level
  API.

## Initial source

The first implementation will be extracted and generalized from these
TheFloorr modules:

- `tokenizer.ts`: type-level GraphQL tokenization;
- `parser.ts`: type-level document and selection parsing;
- `matcher.ts`: validation and result inference against table and relation
  types;
- `aggregate.ts`: aggregate input/output inference and runtime selection
  generation;
- `api.ts`: the consuming API and its runtime query-building requirements.

The parser and tokenizer were adapted from the Supabase client. They are a
starting point, not the compatibility contract. The extracted implementation
must be independently tested and hardened. In particular, the current matcher
only handles a subset of the AST produced by the parser, and the current parser
does not establish complete GraphQL-spec validation merely by producing an AST.

## Goal 1: reusable type-level core

Move GraphQL parsing, validation, and result-type inference from TheFloorr into
this package.

The public core should provide equivalents of:

```ts
type Parsed = ParseGraphQL<Query>;
type Validation = ValidateGraphQL<Query, Schema>;
type Valid = IsValidGraphQL<Query, Schema>;
type Result = GetReturnType<Query, Schema>;
type Variables = GetVariables<Query, Schema>;
```

`ValidateGraphQL` should return `true` for a valid document or a branded,
structured diagnostic for an invalid document. Diagnostics should include a
stable code and message and may include the path to the failing field.
`IsValidGraphQL` should reduce that result to `true | false` for consumers that
only need a boolean.

The exact exported names may be refined during implementation. The required
capabilities are:

1. Tokenize a literal GraphQL string at compile time.
2. Parse it into a type-level representation.
3. Reject malformed syntax rather than silently accepting a parsed prefix.
4. Validate selected fields and nested selections against the schema.
5. Infer the returned object shape, including aliases, lists, and nullability.
6. Produce structured error types for invalid fields, missing selections,
   invalid operations, invalid parameters, and unsupported syntax.
7. Avoid dependencies on TheFloorr types, Apollo, Hasura, or generated database
   modules.

## Goal 2: full documents and partial selections

The core must accept both:

- complete GraphQL documents, including explicit query, mutation, and
  subscription operations; and
- partial selection syntax used by TheFloorr's `api.ts`, such as:

```graphql
id
name
user {
  id
}
```

Partial selections must use a separate API and identify an explicit root type
because they do not identify an operation root themselves:

```ts
type Validation = ValidateSelection<Selection, Schema, "User">;
type Result = GetSelectionType<Selection, Schema, "User">;
```

An unqualified root name resolves through `defaultSchema`; a name such as
`"content.User"` selects another schema. A runtime builder carries this root
context automatically.

The target language includes, at minimum:

- anonymous shorthand queries and named operations;
- variables and variable type declarations;
- fields, arguments, and aliases;
- directives;
- named and inline fragments;
- scalar, object, list, and null values;
- query, mutation, and subscription result inference.

Support is only complete when syntax parsing and schema-aware validation agree.
Parsing a construct without validating its semantics is an intermediate
milestone, not finished support.

Argument and variable validation is part of the first usable release. It must:

- reject unknown, duplicate, and missing required arguments;
- validate literal argument values;
- validate variable declarations and uses against field arguments;
- reject incompatible GraphQL variable types;
- infer the TypeScript object accepted as runtime variables.

GraphQL wire types and TypeScript application types are separate concerns. A
GraphQL input must be able to preserve both:

```ts
type UserId = string & { readonly __table: "User"; };

type UserIdInput = GraphQLInput<"ID!", UserId>;
```

The first parameter describes GraphQL validation and coercion. The second
describes the TypeScript value the consumer must provide. It defaults from the
built-in or custom scalar map when no application-specific type is supplied.
This allows branded identifiers to remain required at call sites even when
their GraphQL wire representation is a standard scalar. An inline GraphQL
literal cannot prove a narrower application type such as `UserId`, so strict
validation must require a typed variable for that argument.

## Goal 3: schema model

The schema preserves the familiar `@kuindji/typed-sql` nesting for plain output
fields and adds separate metadata only where GraphQL requires it:

```ts
type UserId = string & { readonly __table: "User"; };

type Schema = {
    defaultSchema: "public";

    schemas: {
        public: {
            Query: {};
            User: {
                id: UserId;
                email: string;
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

As in `typed-sql`, TypeScript property types should carry scalar and
nullability information wherever that is sufficient.

Object-valued fields live in `relations`. Relations are singular, non-null, and
have non-null items by default. Optional `multiple`, `nullable`, and
`itemNullable` flags express other GraphQL wrapping combinations.

Field arguments live in a general `arguments` map because scalar and
object-valued fields can both accept arguments. `inputs`, custom `scalars`,
`enums`, abstract types, and custom `directives` are additive maps used only
when a schema needs them.

Full documents start from conventional `Query`, `Mutation`, and `Subscription`
objects. The optional `rootTypes` map supports schemas that use different root
type names. There is no separate `operations` map.

## Goal 4: syntax and server variants

Standard GraphQL syntax belongs in the core and must not require an adapter.
The compatibility target is the GraphQL September 2025 specification. Features
may be delivered incrementally, but unsupported constructs must produce an
explicit diagnostic instead of being silently accepted.

Commas are ignored tokens in standard GraphQL, so comma-heavy and comma-free
documents use the same parser. Supabase JavaScript/PostgREST selection strings
such as `id,email,posts(id,title)` are a different language and are outside the
GraphQL core.

The core must parse directive syntax generally. The first release must
understand the result-shape effects of executable `@skip` and `@include`
directives. A field controlled by a runtime condition is optional in the
inferred result; a literal condition can be inferred exactly. Custom directives
are valid when declared in the schema's optional `directives` map.

Server- or framework-specific query-building conventions are isolated from the
core. Examples include Hasura-style:

- `_bool_exp`, `order_by`, and conflict inputs;
- generated insert, update, and delete root fields;
- aggregate selection shapes;
- table naming and root-field naming conventions.

Parsing, validation, and result inference do not use engine adapters. Adapters
may generate schema metadata or provide complete engine-specific runtime
builders, but must not change the meaning of standard GraphQL syntax.

## Runtime query building

Runtime query building is a first-class part of `typed-graphql`, following the
model established by `typed-sql`. The initial builder will stabilize and
professionalize the behavior proven by TheFloorr's `api.ts`.

TheFloorr's `api.ts` demonstrates useful builder behavior:

- build list and single-result queries from a partial selection;
- build insert, update, and delete mutations;
- construct filters, ordering, pagination, and conflict inputs;
- build aggregate selections;
- build subscriptions;
- carry inferred result types through a fluent API.

The package provides shared runtime infrastructure for:

- immutable builder state;
- selection handling;
- operation and variable-definition assembly;
- variable collection and serialization;
- operation naming;
- typed request objects and result extraction paths;
- an injectable transport executor.

An engine adapter provides its complete fluent builder using those helpers.
The bundled Hasura builder owns Hasura-specific filters, ordering, pagination,
CRUD mutations, aggregates, subscriptions, and generated naming conventions.
Other engines may expose different fluent APIs while sharing the same parser,
schema, request, and execution foundations.

The first release should not impose a large universal adapter interface. The
Hasura implementation should establish the helper boundary; a public adapter
contract should be extracted only after another builder demonstrates which
abstractions are genuinely shared.

TheFloorr's implementation also contains application concerns that do not
belong in this package:

- Apollo client ownership;
- authentication and JWT refresh;
- retry and error-reporting policy;
- response-cache behavior;
- TheFloorr table, insert, primary-key, and relation modules.

The builder must produce a transport-neutral typed request containing a
document, variables, and optional operation name and result path. Execution is
provided through an injected function. Transport and application lifecycle
behavior remain consumer responsibilities.

## Delivery sequence

### Phase 1: establish the core

- Port the tokenizer and parser with focused compile-time tests.
- Define explicit parse failures and require complete input consumption.
- Support both document and partial-selection entry points.
- Remove TheFloorr path aliases and generated-type dependencies.

### Phase 2: define schema validation and inference

- Introduce the first `GraphQLSchema` contract based on the
  `typed-sql`-style schema structure.
- Port and generalize matcher behavior.
- Infer aliases, nested objects, lists, and nullability.
- Add structured diagnostics and boolean validation helpers.
- Validate operation roots, arguments, branded runtime variable types,
  fragments, directives, and selection rules.
- Infer the runtime variables object.

### Phase 3: prove migration compatibility

- Recreate representative TheFloorr selections as package tests.
- Cover relations, nullable single relations, multiple relations, aggregates,
  and invalid field selections.
- Replace TheFloorr's parser, tokenizer, and matcher imports with package
  exports without weakening its current type safety.

### Phase 4: build runtime construction

- Extract reusable runtime builder helpers inside `typed-graphql`.
- Build a transport-independent typed request and executor boundary.
- Provide a stable Hasura builder based on TheFloorr's list, mutation,
  aggregate, and subscription behavior.
- Keep Apollo, authentication, retry, caching, and error-reporting policy in
  TheFloorr.

## Success criteria

The goals in this document are achieved when:

- TheFloorr no longer owns its GraphQL tokenizer, parser, or matcher.
- Equivalent partial selections infer the same or stricter result types.
- Full GraphQL documents can be parsed, validated, and inferred against a
  documented schema type.
- Invalid syntax and invalid schema selections produce stable, testable
  compile-time failures.
- Full-document arguments and variables are validated, and the runtime variable
  object preserves application types such as branded identifiers.
- The core has no runtime or application-framework dependency.
- Runtime construction lives inside `typed-graphql` and the Hasura builder
  produces requests equivalent to TheFloorr's existing API without owning its
  transport or application lifecycle.
