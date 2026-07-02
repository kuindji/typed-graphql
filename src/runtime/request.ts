// Transport-neutral request/executor boundary (GOALS.md phase 3).
//
// The library compiles builder state down to a GraphQLRequest; the consumer
// injects a GraphQLExecutor that owns transport, authentication, retry,
// caching, error reporting, and __typename stripping. Errors from the
// executor propagate untouched.

export type GraphQLRequestKind = "query" | "mutation" | "subscription";

export interface GraphQLRequest {
    document: string;
    variables: Record<string, unknown>;
    operationName?: string;
    kind: GraphQLRequestKind;
    /** Path from the response root data object to the payload the caller
     *  asked for, e.g. ["insert_User", "returning"]. */
    resultPath?: readonly string[];
}

export interface GraphQLObserver {
    next: (data: unknown) => void;
    error?: (error: unknown) => void;
}

export interface GraphQLExecutor {
    /** Resolves with the root `data` object of the GraphQL response. */
    execute: (request: GraphQLRequest) => Promise<unknown>;
    /** Required only when subscriptions are used. Returns unsubscribe. */
    subscribe?: (
        request: GraphQLRequest,
        observer: GraphQLObserver,
    ) => () => void;
}

/** Unwrap the executor's root data along resultPath. A missing or
 *  non-object segment yields null. */
export function extractResult(
    data: unknown,
    resultPath?: readonly string[],
): unknown {
    if (data === null || data === undefined) {
        return null;
    }
    if (!resultPath || resultPath.length === 0) {
        return data;
    }
    let current: unknown = data;
    for (const key of resultPath) {
        if (
            current === null || current === undefined
            || typeof current !== "object"
        ) {
            return null;
        }
        current = (current as Record<string, unknown>)[key];
    }
    return current ?? null;
}
