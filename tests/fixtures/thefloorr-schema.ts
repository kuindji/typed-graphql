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
                id: string;
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
