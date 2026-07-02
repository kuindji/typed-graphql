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
