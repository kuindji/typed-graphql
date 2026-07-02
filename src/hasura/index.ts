// @kuindji/typed-graphql/hasura — runtime Hasura builder over the
// transport-neutral executor boundary. See GOALS.md phase 3.

export type { BuilderState, NoSelection } from "./builder.js";
export { HasuraTableBuilder } from "./builder.js";
export type { HasuraClient, HasuraClientConfig } from "./client.js";
export { createHasuraClient } from "./client.js";
export type { AggregateSelectionInput, ConflictSpec } from "./documents.js";
export {
    buildAggregateRequest,
    buildDeleteRequest,
    buildInsertRequest,
    buildListRequest,
    buildUpdateRequest,
    generateAggregateSelection,
} from "./documents.js";
export type {
    AggregateResult,
    HasuraTableName,
    HasuraTables,
    Materialize,
    NonEmptyArray,
    OrderBy,
    OrderDirection,
    StringColumn,
    TableAggregateInput,
    TableAggregateOutput,
    TableColumn,
    TableRow,
    WhereField,
    WhereInput,
} from "./inputs.js";
