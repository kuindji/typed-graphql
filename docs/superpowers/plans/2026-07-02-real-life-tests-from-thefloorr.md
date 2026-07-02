# Real-life Tests from TheFloorr — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate `@kuindji/typed-graphql` against the real GraphQL shapes used in the TheFloorr production monorepo by porting representative selection graphs and builder chains onto one anonymized schema fixture.

**Architecture:** Add a single shared schema fixture in the migration-compat naming style, then two characterization test files — one for selection-graph inference/validation (`GetSelectionType`/`ValidateSelection`/`ValidateGraphQL`), one for the `createHasuraClient` builder (generated document + variables + result type). All cases are ports of real call sites; the library already implements the behavior, so these are **characterization tests**: they should pass on first run. A failing case means a genuine library gap — stop and report it, do not weaken the assertion.

**Tech Stack:** TypeScript (type-level), `expect-type`, `bun:test`. Spec: `docs/superpowers/specs/2026-07-02-real-life-tests-from-thefloorr.md`.

## Global Constraints

- ESM only; relative imports use explicit `.js` extensions (NodeNext).
- Type-level assertions use `expectTypeOf<...>()` from `expect-type`; runtime assertions use `expect`/`test` from `bun:test`.
- Match surrounding code style by hand. Do NOT run `dprint fmt` (it rewrites whole files against the parent workspace config).
- Anonymization = migration-compat naming style (real-ish Hasura table names, generic fields). No `T0/f0/r0` remapping. No TheFloorr business-specific field semantics.
- Characterization tests must PASS on first run. A FAIL = discovered library gap: stop, record it, do not paper over it.
- After the suite lands, run `npm run perf`. If the gate trips purely from the new asserts, rebaseline with `npm run perf:update` and explain the delta in the commit message.

---

### Task 1: Shared anonymized schema fixture

**Files:**
- Create: `tests/fixtures/thefloorr-schema.ts`
- Modify: `tests/compiler/migration-compat.test.ts` (replace the inline `TheFloorrSchema` with an import)

**Interfaces:**
- Produces: `export type TheFloorrSchema`, `export type UserId`, `export type ChatId` from `tests/fixtures/thefloorr-schema.ts`. Later tasks import these.

- [ ] **Step 1: Create the fixture file**

Create `tests/fixtures/thefloorr-schema.ts`:

```ts
import type { GraphQLInput } from "../../src/index.js";

export type UserId = string & { readonly __table: "User"; };
export type ChatId = string & { readonly __table: "Chat"; };

/**
 * Anonymized schema modeled on the TheFloorr Hasura surface. Real-ish table
 * names, generic field names, no business-specific semantics. Shared by the
 * migration-compat and real-usages test suites.
 */
export type TheFloorrSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {};
            Consultation: {
                id: string;
                customerId: string | null;
                friId: string | null;
                paymentDetailsId: string | null;
                title: string | null;
            };
            User: {
                id: UserId;
                email: string | null;
                givenName: string | null;
                familyName: string | null;
                avatar: string | null;
            };
            User_PaymentDetails: {
                paymentDetails: unknown;
                billingAddress: unknown;
                shippingAddress: unknown;
            };
            Look: {
                id: string;
                title: string | null;
                updatedAt: string;
                published: boolean;
                deleted: boolean;
            };
            Look_aggregate: {};
            Look_aggregate_fields: {
                count: number;
            };
            Moodboard: {
                id: string;
                name: string | null;
                image: string | null;
                deleted: boolean;
            };
            Moodboard_ProductReference: {
                id: string;
                position: number | null;
            };
            Catalogue_ProductReference: {
                id: string;
                productId: string;
                region: string;
            };
            Moodboard_aggregate: {};
            Moodboard_aggregate_fields: {
                count: number;
            };
            Chat: {
                id: ChatId;
            };
            Chat_Participant: {
                chatId: ChatId;
                userId: UserId;
                role: string | null;
                lastOnlineAt: string | null;
            };
            Chat_Message: {
                id: string;
                message: string;
                createdAt: string;
                productId: string | null;
                lookId: string | null;
                moodboardId: string | null;
                consultationId: string | null;
                action: string | null;
                hidden: boolean;
            };
            Chat_Image: {
                id: string;
            };
            Chat_VoiceMessage: {
                id: string;
            };
            Product: {
                id: string;
                title: string | null;
            };
        };
    };
    relations: {
        public: {
            Query: {
                Consultation: { type: "Consultation"; multiple: true; };
                Moodboard: { type: "Moodboard"; multiple: true; };
                Moodboard_aggregate: { type: "Moodboard_aggregate"; };
                Chat_Participant: { type: "Chat_Participant"; multiple: true; };
                User: { type: "User"; multiple: true; };
                Look: { type: "Look"; multiple: true; };
            };
            Consultation: {
                customer: { type: "User"; nullable: true; };
                fri: { type: "User"; nullable: true; };
                paymentDetails: {
                    type: "User_PaymentDetails";
                    nullable: true;
                };
                looks: { type: "Look"; multiple: true; };
                looks_aggregate: { type: "Look_aggregate"; };
            };
            Look_aggregate: {
                aggregate: {
                    type: "Look_aggregate_fields";
                    nullable: true;
                };
            };
            Moodboard: {
                productReferences: {
                    type: "Moodboard_ProductReference";
                    multiple: true;
                };
            };
            Moodboard_ProductReference: {
                catalogueProductReference: {
                    type: "Catalogue_ProductReference";
                    nullable: true;
                };
            };
            Moodboard_aggregate: {
                aggregate: {
                    type: "Moodboard_aggregate_fields";
                    nullable: true;
                };
                nodes: { type: "Moodboard"; multiple: true; };
            };
            User: {
                participantInChats: {
                    type: "Chat_Participant";
                    multiple: true;
                };
            };
            Chat_Participant: {
                user: { type: "User"; };
                chat: { type: "Chat"; };
            };
            Chat: {
                participants: {
                    type: "Chat_Participant";
                    multiple: true;
                };
                messages: { type: "Chat_Message"; multiple: true; };
            };
            Chat_Message: {
                images: { type: "Chat_Image"; multiple: true; };
                voiceMessages: {
                    type: "Chat_VoiceMessage";
                    multiple: true;
                };
                look: { type: "Look"; nullable: true; };
                product: { type: "Product"; nullable: true; };
            };
        };
    };
    arguments: {
        public: {
            Consultation: {
                looks: {
                    where: GraphQLInput<"Look_bool_exp">;
                };
                looks_aggregate: {
                    where: GraphQLInput<"Look_bool_exp">;
                };
            };
            Look_aggregate_fields: {
                count: {
                    columns: GraphQLInput<"Look_select_column">;
                    distinct: GraphQLInput<"Boolean">;
                };
            };
            User: {
                participantInChats: {
                    limit: GraphQLInput<"Int">;
                    order_by: GraphQLInput<"Chat_Participant_order_by">;
                };
            };
            Chat: {
                messages: {
                    where: GraphQLInput<"Chat_Message_bool_exp">;
                    order_by: GraphQLInput<"Chat_Message_order_by">;
                    limit: GraphQLInput<"Int">;
                };
            };
            Chat_Message: {
                images: {
                    order_by: GraphQLInput<"Chat_Image_order_by">;
                };
            };
            Query: {
                Consultation: {
                    where: GraphQLInput<"Consultation_bool_exp">;
                    limit: GraphQLInput<"Int">;
                };
                Moodboard: {
                    limit: GraphQLInput<"Int">;
                };
            };
        };
    };
    inputs: {
        public: {
            Consultation_bool_exp: {
                id: GraphQLInput<"String_comparison_exp">;
            };
            Look_bool_exp: {
                deleted: GraphQLInput<"Boolean_comparison_exp">;
                published: GraphQLInput<"Boolean_comparison_exp">;
            };
            Chat_Message_bool_exp: {
                hidden: GraphQLInput<"Boolean_comparison_exp">;
            };
            Chat_Message_order_by: {
                createdAt: GraphQLInput<"order_by">;
            };
            Chat_Image_order_by: {
                position: GraphQLInput<"order_by">;
            };
            Chat_Participant_order_by: {
                lastOnlineAt: GraphQLInput<"order_by">;
            };
            Boolean_comparison_exp: {
                _eq: GraphQLInput<"Boolean">;
            };
            String_comparison_exp: {
                _eq: GraphQLInput<"String">;
            };
        };
    };
    enums: {
        public: {
            Look_select_column: "id" | "published" | "deleted";
            order_by: "asc" | "desc" | "desc_nulls_last";
        };
    };
};
```

- [ ] **Step 2: Refactor migration-compat.test.ts to import the fixture**

In `tests/compiler/migration-compat.test.ts`, delete the entire inline `type TheFloorrSchema = { ... }` block (the local `UserId`/`GraphQLInput` inline types too if present) and replace the imports at the top so the file reads:

```ts
import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type {
    GetSelectionType,
    ValidateSelection,
} from "../../src/index.js";
import type { TheFloorrSchema } from "../fixtures/thefloorr-schema.js";
```

Leave the three existing `test(...)` bodies unchanged — they now resolve `TheFloorrSchema` from the fixture. (The fixture is a superset of the old inline schema, so the existing assertions still hold.)

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). The existing migration-compat assertions compile against the shared fixture.

- [ ] **Step 4: Run the migration-compat suite**

Run: `npx tsc --noEmit && bun test tests/compiler/migration-compat.test.ts`
Expected: PASS — 3 tests. This proves the shared fixture is behavior-equivalent to the old inline schema.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/thefloorr-schema.ts tests/compiler/migration-compat.test.ts
git commit -m "Extract shared anonymized TheFloorr schema fixture"
```

---

### Task 2: Selection-graph tests — relations, aliases, aggregates

**Files:**
- Create: `tests/compiler/real-usages.test.ts`
- Test: same file

**Interfaces:**
- Consumes: `TheFloorrSchema`, `UserId`, `ChatId` from `tests/fixtures/thefloorr-schema.js`; `GetSelectionType`, `ValidateSelection` from `src/index.js`.

- [ ] **Step 1: Write the selection-graph cases**

Create `tests/compiler/real-usages.test.ts`:

```ts
import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type {
    GetReturnType,
    GetSelectionType,
    ValidateGraphQL,
    ValidateSelection,
} from "../../src/index.js";
import type {
    ChatId,
    TheFloorrSchema,
    UserId,
} from "../fixtures/thefloorr-schema.js";

type Schema = TheFloorrSchema;
type Public = Schema["schemas"]["public"];

// Ported from apps/tools/src/pages/LookEditor.tsx (`.select("id title")`).
test("flat scalar selection", () => {
    type Result = GetSelectionType<"id title", Schema, "Look">;
    expectTypeOf<Result>().toEqualTypeOf<{
        id: string;
        title: string | null;
    }>();
});

// Ported from Consultation default graph: nullable object relation.
test("nullable object relation", () => {
    type Result = GetSelectionType<
        "id title customer { id email }",
        Schema,
        "Consultation"
    >;
    expectTypeOf<Result>().toEqualTypeOf<{
        id: string;
        title: string | null;
        customer: {
            id: UserId;
            email: string | null;
        } | null;
    }>();
});

// Ported from apps/tools/src/pages/Moodboard.tsx: nested list -> nullable object.
test("nested list relation with inner nullable object", () => {
    type Result = GetSelectionType<
        `
            id
            name
            productReferences {
                id
                position
                catalogueProductReference {
                    id
                    productId
                    region
                }
            }
        `,
        Schema,
        "Moodboard"
    >;
    expectTypeOf<Result>().toEqualTypeOf<{
        id: string;
        name: string | null;
        productReferences: {
            id: string;
            position: number | null;
            catalogueProductReference: {
                id: string;
                productId: string;
                region: string;
            } | null;
        }[];
    }>();
});

// Ported from packages/common/src/hooks/chat/useChatConnections.ts `graph`:
// 4-level nesting, non-nullable object relations, field args on `messages`.
test("deep chat-connection graph with field arguments", () => {
    type Graph = `
        chatId
        lastOnlineAt
        role
        user { id avatar givenName familyName email }
        chat {
            id
            participants { userId role }
            messages(
                where: { hidden: { _eq: false } }
                order_by: { createdAt: desc }
                limit: 1
            ) {
                message
                createdAt
                productId
                lookId
                moodboardId
                consultationId
                action
                images { id }
                voiceMessages { id }
            }
        }
    `;
    type Result = GetSelectionType<Graph, Schema, "Chat_Participant">;
    expectTypeOf<Result>().toEqualTypeOf<{
        chatId: ChatId;
        lastOnlineAt: string | null;
        role: string | null;
        user: {
            id: UserId;
            avatar: string | null;
            givenName: string | null;
            familyName: string | null;
            email: string | null;
        };
        chat: {
            id: ChatId;
            participants: {
                userId: UserId;
                role: string | null;
            }[];
            messages: {
                message: string;
                createdAt: string;
                productId: string | null;
                lookId: string | null;
                moodboardId: string | null;
                consultationId: string | null;
                action: string | null;
                images: { id: string; }[];
                voiceMessages: { id: string; }[];
            }[];
        };
    }>();
});

// Ported from packages/common/src/graphql/userDefaultGraphs.ts:
// aliased `_aggregate` fields with `where` and `count(columns:, distinct:)`.
test("aliased aggregate fields with arguments", () => {
    type Result = GetSelectionType<
        `
            id
            looksCount: looks_aggregate(where: { deleted: { _eq: false } }) {
                aggregate { count }
            }
            publishedLooksCount: looks_aggregate(where: {
                published: { _eq: true }
                deleted: { _eq: false }
            }) {
                aggregate { count(columns: id, distinct: true) }
            }
        `,
        Schema,
        "Consultation"
    >;
    expectTypeOf<Result>().toEqualTypeOf<{
        id: string;
        looksCount: {
            aggregate: { count: number; } | null;
        };
        publishedLooksCount: {
            aggregate: { count: number; } | null;
        };
    }>();
});
```

- [ ] **Step 2: Typecheck and run**

Run: `npx tsc --noEmit && bun test tests/compiler/real-usages.test.ts`
Expected: PASS — 5 tests. If the deep-graph or field-argument case FAILs, that is a discovered library gap: stop and report it (do not delete or weaken the case).

- [ ] **Step 3: Commit**

```bash
git add tests/compiler/real-usages.test.ts
git commit -m "Port TheFloorr selection graphs: relations, aliases, aggregates"
```

---

### Task 3: Selection-graph tests — fragments, full documents, negatives

**Files:**
- Modify: `tests/compiler/real-usages.test.ts` (append)

**Interfaces:**
- Consumes: the imports already at the top of `tests/compiler/real-usages.test.ts` from Task 2 (`GetReturnType`, `ValidateGraphQL`, `ValidateSelection` are already imported there).

- [ ] **Step 1: Append the fragment-composition, full-document, and negative cases**

Append to `tests/compiler/real-usages.test.ts`:

```ts
// Ported from userDefaultGraphs.ts `${Fragment}` string interpolation:
// a selection assembled from composed `as const` fragments.
const UserFields = "id givenName familyName email" as const;
const ConsultationGraph = `
    id
    title
    customer { ${UserFields} }
    fri { ${UserFields} }
` as const;

test("selection composed from interpolated fragments", () => {
    type Result = GetSelectionType<
        typeof ConsultationGraph,
        Schema,
        "Consultation"
    >;
    expectTypeOf<Result>().toEqualTypeOf<{
        id: string;
        title: string | null;
        customer: {
            id: UserId;
            givenName: string | null;
            familyName: string | null;
            email: string | null;
        } | null;
        fri: {
            id: UserId;
            givenName: string | null;
            familyName: string | null;
            email: string | null;
        } | null;
    }>();
});

// The builder wraps a selection in `query { Table { ...graph } }`; validate the
// full-document path (`ValidateGraphQL` / `GetReturnType`) for a real graph.
test("full document validates and infers a list root", () => {
    type Query = `query {
        Moodboard(limit: 10) {
            id
            name
            productReferences { id position }
        }
    }`;
    expectTypeOf<ValidateGraphQL<Query, Schema>>().toEqualTypeOf<true>();
    expectTypeOf<GetReturnType<Query, Schema>>().toEqualTypeOf<{
        Moodboard: {
            id: string;
            name: string | null;
            productReferences: {
                id: string;
                position: number | null;
            }[];
        }[];
    }>();
});

// Negative cases lifted from the shapes real code must reject.
test("invalid selections surface explicit diagnostics", () => {
    expectTypeOf<ValidateSelection<"id missingField", Schema, "Moodboard">>()
        .toMatchTypeOf<{ code: "UNKNOWN_FIELD"; }>();
    expectTypeOf<
        ValidateSelection<"looks { missingField }", Schema, "Consultation">
    >().toMatchTypeOf<{ code: "UNKNOWN_FIELD"; }>();
    expectTypeOf<ValidateSelection<"customer", Schema, "Consultation">>()
        .toMatchTypeOf<{ code: "MISSING_SELECTION"; }>();
    expectTypeOf<ValidateSelection<"title { id }", Schema, "Consultation">>()
        .toMatchTypeOf<{ code: "UNEXPECTED_SELECTION"; }>();
});
```

- [ ] **Step 2: Typecheck and run**

Run: `npx tsc --noEmit && bun test tests/compiler/real-usages.test.ts`
Expected: PASS — 8 tests total in the file. A FAIL on the fragment or full-document case = discovered gap: stop and report.

- [ ] **Step 3: Commit**

```bash
git add tests/compiler/real-usages.test.ts
git commit -m "Port TheFloorr selection graphs: fragments, documents, negatives"
```

---

### Task 4: Hasura builder tests — queries and aggregates

**Files:**
- Create: `tests/hasura/real-usages.test.ts`
- Test: same file

**Interfaces:**
- Consumes: `createHasuraClient` from `src/hasura/client.js`; `createMockExecutor` from `tests/hasura/fixtures.js`; `TheFloorrSchema`, `UserId`, `ChatId` from `tests/fixtures/thefloorr-schema.js`.
- Note: `createMockExecutor` returns `{ executor, requests, ... }`. Assert `requests[0]!.document` and `requests[0]!.variables`. Operation names are `List<Table>s`, `Insert<Table>`, `Update<Table>`, `Delete<Table>`, `Aggregate<Table>` (verbatim table name, `s` suffix only on List).

- [ ] **Step 1: Write the query/aggregate builder cases**

Create `tests/hasura/real-usages.test.ts`:

```ts
import { expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import { createHasuraClient } from "../../src/hasura/client.js";
import { createMockExecutor } from "./fixtures.js";
import type {
    ChatId,
    TheFloorrSchema,
    UserId,
} from "../fixtures/thefloorr-schema.js";

function makeClient(result: unknown = null) {
    const mock = createMockExecutor(result);
    const client = createHasuraClient<TheFloorrSchema>()({
        executor: mock.executor,
        primaryKeys: {
            User: "id",
            Consultation: "id",
            Chat_Participant: "chatId",
            Look: "id",
        },
        defaultSelections: {},
    });
    return { client, mock };
}

// Ported from useChatConnections.ts: select graph + nested-relation where +
// order + limit on Chat_Participant.
test("nested-relation where with order and limit", async () => {
    const { client, mock } = makeClient({ Chat_Participant: [] });
    await client.table("Chat_Participant")
        .select("chatId role user { id email }")
        .where({
            userId: { _neq: "u1" as UserId },
            chat: {
                participants: { userId: { _eq: "u1" as UserId } },
            },
        })
        .order({ lastOnlineAt: "desc_nulls_last" })
        .limit(50);
    expect(mock.requests[0]!.document).toBe(
        "query ListChat_Participants($where: Chat_Participant_bool_exp, "
            + "$order: [Chat_Participant_order_by!], $limit: Int) "
            + "{ Chat_Participant(where: $where, order_by: $order, "
            + "limit: $limit) { chatId role user { id email } } }",
    );
    expect(mock.requests[0]!.variables).toEqual({
        where: {
            userId: { _neq: "u1" },
            chat: { participants: { userId: { _eq: "u1" } } },
        },
        order: { lastOnlineAt: "desc_nulls_last" },
        limit: 50,
    });
});

// Ported from moodboards.ts: `.where({ _and: [...] }).order().limit().offset()`.
test("_and conjunction with order, limit, offset", async () => {
    const { client, mock } = makeClient({ Look: [] });
    await client.table("Look")
        .select("id title")
        .where({
            _and: [
                { deleted: { _eq: false } },
                { published: { _eq: true } },
            ],
        })
        .order({ updatedAt: "desc" })
        .limit(20)
        .offset(40);
    expect(mock.requests[0]!.variables).toEqual({
        where: {
            _and: [
                { deleted: { _eq: false } },
                { published: { _eq: true } },
            ],
        },
        order: { updatedAt: "desc" },
        limit: 20,
        offset: 40,
    });
    expect(mock.requests[0]!.document).toBe(
        "query ListLooks($where: Look_bool_exp, "
            + "$order: [Look_order_by!], $offset: Int, $limit: Int) "
            + "{ Look(where: $where, order_by: $order, offset: $offset, "
            + "limit: $limit) { id title } }",
    );
});

// Ported from filter components / VatDetails: `.eq`, `.in`, `.like`, `.id`,
// `.one()`, and result typing.
test("shorthand filters, id, and one() result typing", async () => {
    const { client, mock } = makeClient({
        User: [ { id: "u1" as UserId, email: null } ],
    });
    const row = await client.table("User")
        .select("id email")
        .eq("email", "a@b.c")
        .id("u1" as UserId)
        .one();
    expect(row).toEqual({ id: "u1" as UserId, email: null });
    expectTypeOf(row).toEqualTypeOf<
        { id: UserId; email: string | null; } | null
    >();
    expect(mock.requests[0]!.variables).toEqual({
        where: { email: { _eq: "a@b.c" }, id: { _eq: "u1" } },
        limit: 1,
    });
});

// Ported from AdvertiserFilter.tsx: `.aggregate({ nodes }).distinctOn()` and
// the `.count()` sugar.
test("aggregate with nodes and distinctOn", async () => {
    const { client, mock } = makeClient({
        Look_aggregate: { aggregate: { count: 3 } },
    });
    await client.table("Look")
        .aggregate({ aggregate: { count: true } })
        .where({ deleted: { _eq: false } });
    expect(mock.requests[0]!.document).toBe(
        "query AggregateLook($where: Look_bool_exp) "
            + "{ Look_aggregate(where: $where) { aggregate { count } } }",
    );

    const countClient = makeClient({
        Look_aggregate: { aggregate: { count: 7 } },
    });
    await countClient.client.table("Look").count();
    expect(countClient.mock.requests[0]!.document).toBe(
        "query AggregateLook { Look_aggregate { aggregate { count } } }",
    );
});
```

- [ ] **Step 2: Typecheck and run**

Run: `npx tsc --noEmit && bun test tests/hasura/real-usages.test.ts`
Expected: PASS — 4 tests. If a generated-document assertion mismatches, first re-read the actual string from the failure output and confirm whether the difference is a real library gap or a wrong expectation in this plan; if it is a genuine builder gap, stop and report. (Document strings here were derived from `tests/hasura/documents.test.ts` / `client.test.ts`.)

- [ ] **Step 3: Commit**

```bash
git add tests/hasura/real-usages.test.ts
git commit -m "Port TheFloorr builder chains: queries and aggregates"
```

---

### Task 5: Hasura builder tests — mutations

**Files:**
- Modify: `tests/hasura/real-usages.test.ts` (append)

**Interfaces:**
- Consumes: `makeClient` helper and imports already defined in Task 4.

- [ ] **Step 1: Append the mutation cases**

Append to `tests/hasura/real-usages.test.ts`:

```ts
// Ported from actions/chat.ts and look/save.ts: `.insert(...)` and
// `.select("id").insert(...)` (typed returning).
test("insert emits an insert mutation with returning selection", async () => {
    const { client, mock } = makeClient({
        insert_Look: { returning: [ { id: "l1" } ] },
    });
    await client.table("Look").select("id").insert({ title: "Spring" });
    expect(mock.requests[0]!.document).toBe(
        "mutation InsertLook($input: [Look_insert_input!]!) "
            + "{ insert_Look(objects: $input) { returning { id } } }",
    );
    expect(mock.requests[0]!.variables).toEqual({
        input: [ { title: "Spring" } ],
    });
});

// Ported from bulk inserts using `.onConflict(false)` (ignore duplicates).
test("insert with onConflict(false) ignores duplicates", async () => {
    const { client, mock } = makeClient({
        insert_Look: { returning: [] },
    });
    await client.table("Look")
        .select("id")
        .insert([ { title: "A" }, { title: "B" } ])
        .onConflict(false);
    expect(mock.requests[0]!.document).toBe(
        "mutation InsertLook($input: [Look_insert_input!]!, "
            + "$conflict: Look_on_conflict) "
            + "{ insert_Look(objects: $input, on_conflict: $conflict) "
            + "{ returning { id } } }",
    );
    expect(mock.requests[0]!.variables.conflict).toEqual({
        constraint: "Look_pkey",
        update_columns: [],
    });
});

// Ported from actions/consultation.ts and look/save.ts: `.update(data).id(id)`.
test("update by id emits an update mutation", async () => {
    const { client, mock } = makeClient({
        update_Consultation: { affected_rows: 1 },
    });
    await client.table("Consultation")
        .update({ title: "Renamed" })
        .id("c1");
    expect(mock.requests[0]!.document).toBe(
        "mutation UpdateConsultation($where: Consultation_bool_exp!, "
            + "$input: Consultation_set_input!) "
            + "{ update_Consultation(where: $where, _set: $input) "
            + "{ affected_rows } }",
    );
    expect(mock.requests[0]!.variables).toEqual({
        where: { id: { _eq: "c1" } },
        input: { title: "Renamed" },
    });
});

// Ported from ConsultationEditorSheet.tsx: `.remove().where({ id: { _in } })`.
test("remove with an _in filter emits a delete mutation", async () => {
    const { client, mock } = makeClient({
        delete_Look: { affected_rows: 2 },
    });
    await client.table("Look")
        .remove()
        .where({ id: { _in: [ "l1", "l2" ] } });
    expect(mock.requests[0]!.document).toBe(
        "mutation DeleteLook($where: Look_bool_exp!) "
            + "{ delete_Look(where: $where) { affected_rows } }",
    );
    expect(mock.requests[0]!.variables).toEqual({
        where: { id: { _in: [ "l1", "l2" ] } },
    });
});
```

- [ ] **Step 2: Typecheck and run**

Run: `npx tsc --noEmit && bun test tests/hasura/real-usages.test.ts`
Expected: PASS — 8 tests total in the file. A mutation-document mismatch that reflects real builder behavior = discovered gap: stop and report.

- [ ] **Step 3: Commit**

```bash
git add tests/hasura/real-usages.test.ts
git commit -m "Port TheFloorr builder chains: insert, update, remove mutations"
```

---

### Task 6: Full-suite verification and perf gate

**Files:** none (verification + possible baseline update)

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — full typecheck, `strictNullChecks:false` pass, then `bun test` green including the two new `real-usages.test.ts` files and the refactored `migration-compat.test.ts`.

- [ ] **Step 2: Run the perf gate**

Run: `npm run perf`
Expected: Either PASS, or a FAIL reporting increased instantiation counts caused solely by the new type-level asserts.

- [ ] **Step 3: Rebaseline only if the gate tripped from the new asserts**

If Step 2 failed purely because of the added tests (no compiler source changed in this plan), run:

Run: `npm run perf:update`

Then verify the diff to `scripts/perf-baseline.json` is a modest increase consistent with the new asserts (not a regression in an unrelated counter).

- [ ] **Step 4: Commit any baseline change**

```bash
git add scripts/perf-baseline.json
git commit -m "Rebaseline perf for real-life TheFloorr test asserts"
```

(Skip this commit if Step 2 passed and no baseline change was needed.)

---

## Self-Review

**Spec coverage:**
- Fixture (shared, migration-compat style, chat/team/aggregate topology) → Task 1. ✓
- Selection-graph tests (flat, object relation, list relation, deep nesting, aliases, inline aggregate, field args, fragments, full documents, negatives) → Tasks 2–3. ✓
- Builder tests (where/order/limit/offset, nested filters, `_and`/`_in`, aggregate/distinctOn/count, shorthands, insert/onConflict/update.id/remove) → Tasks 4–5. ✓
- `#userId` placeholder handling → replaced with literals in ported cases (no placeholder appears in any test string). ✓
- Verification incl. perf rebaseline path → Task 6. ✓
- Out-of-scope items (raw SQL, Shopify, subscription transport) → not tested, matching spec. ✓
  - `_or`/`_nin`/`_ilike`/`.neq`/`.gt`/`.lt`/`.isNull` are covered by the existing `tests/hasura/builder.test.ts`; the representative-per-shape ports here exercise the distinct real shapes (`_and`, nested-relation where, `_in`, shorthand `.eq`/`.id`) without duplicating that file. Noted as an intentional non-duplication.

**Placeholder scan:** No "TBD"/"TODO"/"handle edge cases"/"similar to Task N". Every code step shows full code. ✓

**Type consistency:** `TheFloorrSchema`/`UserId`/`ChatId` defined in Task 1 are the exact names imported in Tasks 2–5. `makeClient` helper defined in Task 4 is reused in Task 5. Primary keys (`Chat_Participant: "chatId"`) match the fixture field names. Operation-name/document strings match the formats in `tests/hasura/documents.test.ts`. ✓
