// Branded structured diagnostic. `ValidateGraphQL` returns `true | GraphQLError`;
// `IsValidGraphQL` collapses it to boolean. First-error-only: producers
// short-circuit on the first failure (spec §2).
export interface GraphQLError<
    Code extends string = string,
    Msg extends string = string,
    Path = undefined,
> {
    readonly __graphqlError: true;
    code: Code;
    message: Msg;
    path?: Path;
}

// consumed in Phase 2 (validation/inference)
export type IsGraphQLError<T> = T extends { readonly __graphqlError: true } ? true
    : false;

// Runtime constructor — used by tests and by any runtime that wants to surface
// a diagnostic value. The type-level engine never calls this; it composes the
// `GraphQLError<...>` type directly.
export function makeError<Code extends string, Msg extends string>(
    code: Code,
    message: Msg,
): GraphQLError<Code, Msg> {
    return { __graphqlError: true, code, message };
}
