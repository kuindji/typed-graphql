// createHasuraClient — binds a GraphQLSchema, an injected executor, and
// Hasura-specific metadata (primary keys, default selections, insert
// shapes) into per-table builders. The factory is curried so Schema (and
// optionally InsertTypes) stay explicit while config literals are inferred;
// `const C` preserves defaultSelections literals for lazy per-table
// GetSelectionType evaluation.

import type { GetSelectionType } from "../index.js";
import type { GraphQLExecutor } from "../runtime/request.js";
import type { GraphQLSchema } from "../schema.js";
import { HasuraTableBuilder, type NoSelection } from "./builder.js";
import type { HasuraTableName, TableColumn, TableRow } from "./inputs.js";

export interface HasuraClientConfig<S extends GraphQLSchema> {
    executor: GraphQLExecutor;
    /** Runtime primary-key column names; enables .id() per table. */
    primaryKeys?: { [T in HasuraTableName<S>]?: TableColumn<S, T>; };
    /** Default selection per table, validated lazily against the schema
     *  when the table is used. */
    defaultSelections?: { [T in HasuraTableName<S>]?: string; };
}

type InsertTypesShape<S extends GraphQLSchema> = {
    [T in HasuraTableName<S>]?: object;
};

type DefaultSelectionOf<C, T> = C extends
    { defaultSelections: infer DS extends Record<string, unknown>; }
    ? T extends keyof DS ? DS[T] : undefined
    : undefined;

type SelectionResultOf<
    S extends GraphQLSchema,
    C,
    T extends HasuraTableName<S>,
> = DefaultSelectionOf<C, T> extends infer G extends string
    ? GetSelectionType<G, S, T>
    : NoSelection;

type InsertTypeOf<
    S extends GraphQLSchema,
    InsertTypes,
    T extends HasuraTableName<S>,
> = T extends keyof InsertTypes ? InsertTypes[T] extends object ? InsertTypes[T]
    : Partial<TableRow<S, T>>
    : Partial<TableRow<S, T>>;

type PrimaryKeyValueOf<
    S extends GraphQLSchema,
    C,
    T extends HasuraTableName<S>,
> = C extends { primaryKeys: infer PKs; }
    ? T extends keyof PKs
        ? PKs[T] extends infer K extends string & keyof TableRow<S, T>
            ? TableRow<S, T>[K]
        : never
    : never
    : never;

export type HasuraClient<
    S extends GraphQLSchema,
    InsertTypes,
    C extends HasuraClientConfig<S>,
> = {
    table<T extends HasuraTableName<S>>(name: T): HasuraTableBuilder<
        S,
        T,
        SelectionResultOf<S, C, T>,
        InsertTypeOf<S, InsertTypes, T>,
        PrimaryKeyValueOf<S, C, T>
    >;
};

export function createHasuraClient<
    S extends GraphQLSchema,
    InsertTypes extends InsertTypesShape<S> = {},
>() {
    return function create<const C extends HasuraClientConfig<S>>(
        config: C,
    ): HasuraClient<S, InsertTypes, C> {
        const primaryKeys = (config.primaryKeys ?? {}) as Record<
            string,
            string | undefined
        >;
        const defaultSelections = (config.defaultSelections ?? {}) as Record<
            string,
            string | undefined
        >;
        const client = {
            table(name: HasuraTableName<S>) {
                return new HasuraTableBuilder({
                    table: name,
                    executor: config.executor,
                    mode: "list",
                    selection: defaultSelections[name] ?? null,
                    primaryKey: primaryKeys[name] ?? null,
                });
            },
        };
        // The runtime object is untyped w.r.t. the per-table generics (they
        // only exist at the type level), so widen through unknown once here.
        return client as unknown as HasuraClient<S, InsertTypes, C>;
    };
}
