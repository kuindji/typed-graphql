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
            id: string;
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
            id: string;
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
            id: string;
            givenName: string | null;
            familyName: string | null;
            email: string | null;
        } | null;
        fri: {
            id: string;
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
