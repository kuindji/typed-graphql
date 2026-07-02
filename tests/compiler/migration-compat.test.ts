import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type {
    GetSelectionType,
    ValidateSelection,
} from "../../src/index.js";
import type { TheFloorrSchema } from "../fixtures/thefloorr-schema.js";

test("phase 2 compatibility covers relations and aliased aggregates", () => {
    type Result = GetSelectionType<
        `
            id
            title
            customer {
                id
                email
            }
            paymentDetails {
                paymentDetails
                billingAddress
                shippingAddress
            }
            looks {
                id
                updatedAt
            }
            looksCount: looks_aggregate(where: { deleted: { _eq: false }}) {
                aggregate {
                    count
                }
            }
            publishedLooksCount: looks_aggregate(where: {
                published: { _eq: true }
                deleted: { _eq: false }
            }) {
                aggregate {
                    count(columns: id, distinct: true)
                }
            }
        `,
        TheFloorrSchema,
        "Consultation"
    >;

    expectTypeOf<Result>().toEqualTypeOf<{
        id: string;
        title: string | null;
        customer: {
            id: string;
            email: string | null;
        } | null;
        paymentDetails: {
            paymentDetails: unknown;
            billingAddress: unknown;
            shippingAddress: unknown;
        } | null;
        looks: {
            id: string;
            updatedAt: string;
        }[];
        looksCount: {
            aggregate: {
                count: number;
            } | null;
        };
        publishedLooksCount: {
            aggregate: {
                count: number;
            } | null;
        };
    }>();
});

test("phase 2 compatibility covers nested list relations", () => {
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
        TheFloorrSchema,
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

test("phase 2 compatibility rejects invalid field selections explicitly", () => {
    expectTypeOf<ValidateSelection<"id missingField", TheFloorrSchema, "Moodboard">>()
        .toMatchTypeOf<{ code: "UNKNOWN_FIELD"; }>();
    expectTypeOf<ValidateSelection<"looks { missingField }", TheFloorrSchema, "Consultation">>()
        .toMatchTypeOf<{ code: "UNKNOWN_FIELD"; }>();
    expectTypeOf<ValidateSelection<"customer", TheFloorrSchema, "Consultation">>()
        .toMatchTypeOf<{ code: "MISSING_SELECTION"; }>();
    expectTypeOf<ValidateSelection<"title { id }", TheFloorrSchema, "Consultation">>()
        .toMatchTypeOf<{ code: "UNEXPECTED_SELECTION"; }>();
});
