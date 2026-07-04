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
    /** Resolves with the root `data` object of the GraphQL response.
     *  An executor MAY reject on a genuine transport failure, but a GraphQL
     *  response error is expected to be reported out-of-band and resolved as
     *  its (possibly null) data — the builder resolves a missing payload to
     *  the mode's empty value rather than throwing. `unwrapResponse` remains
     *  an opt-in strict helper that rejects on a non-empty `errors` list. */
    execute: (request: GraphQLRequest) => Promise<unknown>;
    /** Required only when subscriptions are used. Returns unsubscribe. */
    subscribe?: (
        request: GraphQLRequest,
        observer: GraphQLObserver,
    ) => () => void;
}

/** One error entry from a GraphQL response `errors` list (spec §7.1.2). */
export interface GraphQLResponseErrorItem {
    message: string;
    locations?: readonly { line: number; column: number; }[];
    path?: readonly (string | number)[];
    extensions?: Record<string, unknown>;
}

/** Thrown by `unwrapResponse` when a response carries a non-empty `errors`
 *  list. Exposes the original list so callers can inspect paths and
 *  extensions. */
export class GraphQLResponseError extends Error {
    readonly errors: readonly GraphQLResponseErrorItem[];

    constructor(errors: readonly GraphQLResponseErrorItem[]) {
        const messages = errors.map((error) => error.message).join("; ");
        super(
            `GraphQL request failed with ${errors.length} error${
                errors.length === 1 ? "" : "s"
            }: ${messages}`,
        );
        this.name = "GraphQLResponseError";
        this.errors = errors;
    }
}

/** Read the `errors` list from a GraphQL response envelope. Anything that
 *  is not an envelope with a non-empty `errors` array yields []. */
export function extractErrors(
    response: unknown,
): GraphQLResponseErrorItem[] {
    if (
        response === null || response === undefined
        || typeof response !== "object"
    ) {
        return [];
    }
    const errors = (response as Record<string, unknown>)["errors"];
    return Array.isArray(errors) ? errors : [];
}

/** Unwrap a standard GraphQL response envelope into its root `data`,
 *  throwing GraphQLResponseError when the response carries errors. Meant
 *  for executors: `execute: async (req) => unwrapResponse(await post(req))`.
 *  A value that is not an envelope at all throws a plain Error instead of
 *  being silently treated as empty data. */
export function unwrapResponse(response: unknown): unknown {
    if (
        response === null || response === undefined
        || typeof response !== "object"
    ) {
        throw new Error("GraphQL response is not an object");
    }
    const errors = extractErrors(response);
    if (errors.length > 0) {
        throw new GraphQLResponseError(errors);
    }
    if (!("data" in response)) {
        throw new Error(
            'GraphQL response has neither "data" nor "errors"',
        );
    }
    return (response as Record<string, unknown>)["data"] ?? null;
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
