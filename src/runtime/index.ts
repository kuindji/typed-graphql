// @kuindji/typed-graphql/runtime — transport-neutral typed requests and the
// executor boundary. See GOALS.md phase 3.

export type {
    GraphQLExecutor,
    GraphQLObserver,
    GraphQLRequest,
    GraphQLRequestKind,
} from "./request.js";
export { extractResult } from "./request.js";
export type { OperationOptions, VariableDefinition } from "./document.js";
export { buildFieldArguments, buildOperationDocument } from "./document.js";
