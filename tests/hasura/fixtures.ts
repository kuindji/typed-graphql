import type {
    GraphQLExecutor,
    GraphQLObserver,
    GraphQLRequest,
} from "../../src/runtime/request.js";

export type UserId = string & { readonly __table: "User"; };

export type TestSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {};
            User: {
                id: UserId;
                email: string | null;
                age: number;
                active: boolean;
            };
            Post: {
                id: string;
                title: string;
                userId: UserId;
                rating: number | null;
            };
        };
    };
    relations: {
        public: {
            Query: {
                user: { type: "User"; nullable: true; };
            };
            User: {
                posts: { type: "Post"; multiple: true; };
            };
            Post: {
                user: { type: "User"; };
            };
        };
    };
};

export function createMockExecutor(result: unknown = null) {
    const requests: GraphQLRequest[] = [];
    const observers: GraphQLObserver[] = [];
    let unsubscribed = false;
    const executor: GraphQLExecutor = {
        execute: async (request) => {
            requests.push(request);
            return result;
        },
        subscribe: (request, observer) => {
            requests.push(request);
            observers.push(observer);
            return () => {
                unsubscribed = true;
            };
        },
    };
    return {
        executor,
        requests,
        emit: (data: unknown) => {
            for (const observer of observers) {
                observer.next(data);
            }
        },
        emitError: (err: unknown) => {
            for (const observer of observers) {
                observer.error?.(err);
            }
        },
        wasUnsubscribed: () => unsubscribed,
    };
}
