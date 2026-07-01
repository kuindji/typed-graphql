import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type {
    GetSelectionType,
    GraphQLInput,
    ValidateSelection,
} from "../../src/index.js";

type TheFloorrSchema = {
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
                id: string;
                email: string | null;
                givenName: string | null;
                familyName: string | null;
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
        };
    };
    relations: {
        public: {
            Query: {
                Consultation: {
                    type: "Consultation";
                    multiple: true;
                };
                Moodboard_aggregate: {
                    type: "Moodboard_aggregate";
                };
                Moodboard: {
                    type: "Moodboard";
                    multiple: true;
                };
            };
            Consultation: {
                customer: {
                    type: "User";
                    nullable: true;
                };
                fri: {
                    type: "User";
                    nullable: true;
                };
                paymentDetails: {
                    type: "User_PaymentDetails";
                    nullable: true;
                };
                looks: {
                    type: "Look";
                    multiple: true;
                };
                looks_aggregate: {
                    type: "Look_aggregate";
                };
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
                nodes: {
                    type: "Moodboard";
                    multiple: true;
                };
            };
        };
    };
    arguments: {
        public: {
            Consultation: {
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
        };
    };
};

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
