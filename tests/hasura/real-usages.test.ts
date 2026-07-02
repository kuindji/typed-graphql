import { expect, test } from "bun:test";
import { expectTypeOf } from "expect-type";

import { createHasuraClient } from "../../src/hasura/client.js";
import { createMockExecutor } from "./fixtures.js";
import type {
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
        User: [ { id: "u1", email: null } ],
    });
    const row = await client.table("User")
        .select("id email")
        .eq("email", "a@b.c")
        .id("u1")
        .one();
    expect(row).toEqual({ id: "u1", email: null });
    expectTypeOf(row).toEqualTypeOf<
        { id: string; email: string | null; } | null
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
