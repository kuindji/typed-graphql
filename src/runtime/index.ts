// @kuindji/typed-graphql/runtime — transport-neutral typed requests and the
// executor boundary. See GOALS.md phase 3.

export type { OperationOptions, VariableDefinition } from "./document.js";
export { buildFieldArguments, buildOperationDocument } from "./document.js";
export type {
    GraphQLExecuteResult,
    GraphQLExecutor,
    GraphQLObserver,
    GraphQLRequest,
    GraphQLRequestKind,
    GraphQLResponseErrorItem,
} from "./request.js";
export {
    extractErrors,
    extractResult,
    GraphQLResponseError,
    unwrapResponse,
} from "./request.js";
