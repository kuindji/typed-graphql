// Hasura input types derived from the compiler's GraphQLSchema: one schema
// source of truth. Tables come from schemas[defaultSchema] minus the
// operation roots; where/order relation nesting comes from relations.

import type { GraphQLSchema } from "../schema.js";

export type Materialize<T> = { [K in keyof T]: T[K]; } & {};

export type NonEmptyArray<T> = readonly [ T, ...T[] ];

// Optional schema sections are read with the conditional-infer pattern
// (S extends { rootTypes: infer R }), matching src/compiler/compile.ts —
// indexed access on an absent optional property does not resolve.
type RootName<
    S extends GraphQLSchema,
    K extends "query" | "mutation" | "subscription",
    D extends string,
> = S extends { rootTypes: { [P in K]: infer N; }; } ? N extends string ? N : D
    : D;

type RootTypeNames<S extends GraphQLSchema> =
    | RootName<S, "query", "Query">
    | RootName<S, "mutation", "Mutation">
    | RootName<S, "subscription", "Subscription">;

export type HasuraTables<S extends GraphQLSchema> = Omit<
    S["schemas"][S["defaultSchema"]],
    RootTypeNames<S>
>;

export type HasuraTableName<S extends GraphQLSchema> =
    & string
    & keyof HasuraTables<S>;

export type TableRow<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = HasuraTables<S>[T];

export type TableColumn<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = string & keyof TableRow<S, T>;

export type StringColumn<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    [K in TableColumn<S, T>]: NonNullable<TableRow<S, T>[K]> extends string ? K
        : never;
}[TableColumn<S, T>];

export type NumericColumn<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    [K in TableColumn<S, T>]: NonNullable<TableRow<S, T>[K]> extends number ? K
        : never;
}[TableColumn<S, T>];

type SchemaRelations<S extends GraphQLSchema> = S extends
    { relations: infer R; }
    ? S["defaultSchema"] extends keyof R ? R[S["defaultSchema"]] : {}
    : {};

type TableRelations<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = T extends keyof SchemaRelations<S> ? SchemaRelations<S>[T] : {};

type StringOperators = {
    _like?: string;
    _nlike?: string;
    _ilike?: string;
    _nilike?: string;
    _regex?: string;
    _iregex?: string;
    _nregex?: string;
    _niregex?: string;
    _similar?: string;
    _nsimilar?: string;
};

export type WhereField<V> =
    & {
        _eq?: V;
        _neq?: V;
        _in?: V[];
        _nin?: V[];
        _gt?: V;
        _gte?: V;
        _lt?: V;
        _lte?: V;
        _is_null?: boolean;
    }
    & (V extends string ? StringOperators : {});

type WhereColumns<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    [K in TableColumn<S, T>]?: WhereField<NonNullable<TableRow<S, T>[K]>>;
};

type WhereRelations<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    [R in string & keyof TableRelations<S, T>]?: TableRelations<S, T>[R] extends
        { type: infer RT; } ? RT extends HasuraTableName<S> ? WhereInput<S, RT>
        : never
        : never;
};

export type WhereInput<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> =
    & {
        _and?: WhereInput<S, T> | WhereInput<S, T>[];
        _or?: WhereInput<S, T> | WhereInput<S, T>[];
        _not?: WhereInput<S, T> | WhereInput<S, T>[];
    }
    & WhereColumns<S, T>
    & WhereRelations<S, T>;

export type OrderDirection =
    | "asc"
    | "desc"
    | "asc_nulls_first"
    | "asc_nulls_last"
    | "desc_nulls_first"
    | "desc_nulls_last";

// Hasura order_by semantics: object relationships order by the related
// table's columns; array relationships can only order by aggregates,
// exposed under the `<relation>_aggregate` key.
type AggregateOrderBy<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    count?: OrderDirection;
    max?: { [K in TableColumn<S, T>]?: OrderDirection; };
    min?: { [K in TableColumn<S, T>]?: OrderDirection; };
    avg?: { [K in NumericColumn<S, T>]?: OrderDirection; };
    sum?: { [K in NumericColumn<S, T>]?: OrderDirection; };
};

type OrderRelations<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> =
    & {
        [
            R in string & keyof TableRelations<S, T> as TableRelations<
                S,
                T
            >[R] extends { multiple: true; } ? never : R
        ]?: TableRelations<S, T>[R] extends { type: infer RT; }
            ? RT extends HasuraTableName<S>
                ? { [K in TableColumn<S, RT>]?: OrderDirection; }
            : never
            : never;
    }
    & {
        [
            R in string & keyof TableRelations<S, T> as TableRelations<
                S,
                T
            >[R] extends { multiple: true; } ? `${R}_aggregate` : never
        ]?: TableRelations<S, T>[R] extends { type: infer RT; }
            ? RT extends HasuraTableName<S> ? AggregateOrderBy<S, RT>
            : never
            : never;
    };

export type OrderBy<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> =
    & { [K in TableColumn<S, T>]?: OrderDirection; }
    & OrderRelations<S, T>;

export type TableAggregateInput<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
> = {
    count?: true | {
        columns?: TableColumn<S, T>;
        distinct?: boolean;
    };
    max?: NonEmptyArray<TableColumn<S, T>>;
    min?: NonEmptyArray<TableColumn<S, T>>;
    avg?: NonEmptyArray<NumericColumn<S, T>>;
    sum?: NonEmptyArray<NumericColumn<S, T>>;
};

type AggregateColumns<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
    Columns,
> = Columns extends readonly (infer C)[]
    ? { [K in C & TableColumn<S, T>]: TableRow<S, T>[K]; }
    : never;

export type TableAggregateOutput<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
    Input,
> = Materialize<
    & (Input extends { count: {} | true; } ? { count: number; } : {})
    & (Input extends { max: infer M; } ? { max: AggregateColumns<S, T, M>; }
        : {})
    & (Input extends { min: infer M; } ? { min: AggregateColumns<S, T, M>; }
        : {})
    & (Input extends { avg: infer M; } ? { avg: AggregateColumns<S, T, M>; }
        : {})
    & (Input extends { sum: infer M; } ? { sum: AggregateColumns<S, T, M>; }
        : {})
>;

export type AggregateResult<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
    Agg,
> = Materialize<
    & (Agg extends { aggregate: infer A; }
        ? { aggregate: TableAggregateOutput<S, T, A>; }
        : {})
    & (Agg extends { nodes: infer N; }
        ? N extends readonly (infer C)[]
            ? { nodes: { [K in C & TableColumn<S, T>]: TableRow<S, T>[K]; }[]; }
        : {}
        : {})
>;
