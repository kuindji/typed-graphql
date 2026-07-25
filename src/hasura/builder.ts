// Immutable chainable Hasura table builder — a cleaned-up port of
// TheFloorr's ApiConstructor. Every method returns a new builder; awaiting
// the builder compiles state into a GraphQLRequest and runs it through the
// injected executor. Deviations from TheFloorr are documented in
// docs/superpowers/specs/2026-07-02-phase3-runtime-construction-design.md:
// one() sets limit 1, update/remove require a where filter, subscriptions
// always emit subscription documents, and there is no self() (awaiting the
// builder directly covers it, since it is PromiseLike).

import type { GraphQLError } from "../diagnostics.js";
import type { GetSelectionType, ValidateSelection } from "../index.js";
import {
    extractResult,
    type GraphQLExecutor,
    type GraphQLRequest,
} from "../runtime/request.js";
import type { GraphQLSchema } from "../schema.js";
import {
    type AggregateSelectionInput,
    buildAggregateRequest,
    buildDeleteRequest,
    buildInsertRequest,
    buildListRequest,
    buildUpdateRequest,
    type ConflictSpec,
} from "./documents.js";
import type {
    AggregateResult,
    HasuraTableName,
    NonEmptyArray,
    OrderBy,
    StringColumn,
    TableAggregateInput,
    TableColumn,
    TableRow,
    WhereInput,
} from "./inputs.js";

export type NoSelection = GraphQLError<
    "NO_SELECTION",
    "Call select()/customSelect() or configure a default selection for this table"
>;

// "Plain" means an object literal or Object.create(null) — a container the
// builder may walk field by field. Class instances (Date, Decimal.js, Buffer,
// Map, …) are leaf values: rebuilding one from Object.entries() erases it
// (Object.entries(new Date()) is []), which silently turned a date filter
// into `{}`. Arrays are excluded here too; cloneCondition handles them first.
function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

// _and/_or accept a single bool_exp or a list; normalize to a list so
// repeated conditions can concatenate.
function toConditionList(value: unknown): unknown[] {
    return value === undefined ? []
        : Array.isArray(value) ? value
        : [ value ];
}

// Detach captured filters from caller-owned objects so mutating a condition
// after passing it in cannot reach into the builder's state. Only plain
// object/array containers are copied; leaf values (primitives, Dates,
// custom scalars) stay by reference.
function cloneCondition<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map(cloneCondition) as T;
    }
    if (isPlainObject(value)) {
        const copy: Record<string, unknown> = {};
        for (const [ key, entry ] of Object.entries(value)) {
            copy[key] = cloneCondition(entry);
        }
        return copy as T;
    }
    return value;
}

type BuilderMode =
    | "list"
    | "single"
    | "aggregate"
    | "insert"
    | "update"
    | "remove";

export interface BuilderState {
    table: string;
    executor: GraphQLExecutor;
    mode: BuilderMode;
    selection: string | null;
    primaryKey: string | null;
    where?: Record<string, unknown>;
    /** Where each column operator written by an operator method currently
     *  lives: `-1` = the top-level column entry, `>= 0` = that index in
     *  `where._and`. Lets a repeated operator replace its own earlier value
     *  (documented last-wins) without ever overwriting a condition that came
     *  from where(). */
    operatorSlots?: Record<string, Record<string, number>>;
    order?: unknown;
    offset?: number;
    limit?: number;
    distinctOn?: string;
    agg?: { aggregate?: AggregateSelectionInput; nodes?: readonly string[]; };
    data?: unknown;
    conflict?: ConflictSpec | false;
}

export class HasuraTableBuilder<
    S extends GraphQLSchema,
    T extends HasuraTableName<S>,
    V,
    Insert,
    PK,
    IsSingle extends boolean = false,
    IsNullable extends boolean = false,
    Result = IsSingle extends true ? IsNullable extends true ? V | null : V
        : V[],
> implements PromiseLike<Result> {
    private readonly state: BuilderState;

    constructor(state: BuilderState) {
        this.state = state;
    }

    private next<
        V2 = V,
        S2 extends boolean = IsSingle,
        N2 extends boolean = IsNullable,
    >(patch: Partial<BuilderState>) {
        return new HasuraTableBuilder<S, T, V2, Insert, PK, S2, N2>({
            ...this.state,
            ...patch,
        });
    }

    /** Every where() call is a conjunct: repeated `_and` entries
     * concatenate, disjoint column operators merge, and anything that
     * cannot merge without changing meaning (repeated `_or`/`_not`, a
     * colliding operator) is ANDed on via `_and` instead of overwriting
     * the earlier condition. */
    private mergeWhere(condition: Record<string, unknown>) {
        const existing = this.state.where;
        if (existing === undefined) {
            return { ...condition };
        }
        const merged: Record<string, unknown> = { ...existing };
        const conjuncts: Record<string, unknown>[] = [];
        for (const [ key, value ] of Object.entries(condition)) {
            if (!(key in merged)) {
                merged[key] = value;
                continue;
            }
            const current = merged[key];
            if (key === "_and") {
                merged[key] = [
                    ...toConditionList(current),
                    ...toConditionList(value),
                ];
            } else if (
                key !== "_or" && key !== "_not"
                && isPlainObject(current) && isPlainObject(value)
                && Object.keys(value).every((op) => !(op in current))
            ) {
                merged[key] = { ...current, ...value };
            } else {
                conjuncts.push({ [key]: value });
            }
        }
        if (conjuncts.length > 0) {
            merged["_and"] = [ ...toConditionList(merged["_and"]), ...conjuncts ];
        }
        return merged;
    }

    /** Merges operators into an existing column entry instead of replacing
     * the whole column, so chaining filters on the same column (e.g.
     * `.gt("age", 18).lt("age", 65)`) accumulates operators rather than
     * silently dropping earlier ones. A repeated operator replaces its own
     * earlier value (last-wins), but one that collides with a condition
     * where() put there is conjoined via `_and` instead — where()'s
     * conjunct contract holds no matter which order the calls come in.
     * operatorSlots remembers where each owned operator ended up so the
     * replace stays a replace even once it lives inside `_and`. */
    private applyFieldOperator(
        field: string,
        operators: Record<string, unknown>,
    ): Partial<BuilderState> {
        const where: Record<string, unknown> = { ...this.state.where };
        const slots = { ...this.state.operatorSlots };
        const fieldSlots: Record<string, number> = { ...slots[field] };
        const conjuncts = toConditionList(where["_and"]).slice();
        let conjunctsChanged = false;

        for (const [ op, value ] of Object.entries(cloneCondition(operators))) {
            const slot = fieldSlots[op];
            if (slot !== undefined && slot >= 0) {
                conjuncts[slot] = { [field]: { [op]: value } };
                conjunctsChanged = true;
                continue;
            }
            const existing = where[field];
            const column = existing === undefined ? {}
                : isPlainObject(existing) ? existing
                : undefined;
            if (column === undefined || (slot === undefined && op in column)) {
                fieldSlots[op] = conjuncts.length;
                conjuncts.push({ [field]: { [op]: value } });
                conjunctsChanged = true;
                continue;
            }
            where[field] = { ...column, [op]: value };
            fieldSlots[op] = -1;
        }

        if (conjunctsChanged) {
            where["_and"] = conjuncts;
        }
        slots[field] = fieldSlots;
        return { where, operatorSlots: slots };
    }

    where(where: WhereInput<S, T>) {
        return this.next({
            where: this.mergeWhere(
                cloneCondition(where as Record<string, unknown>),
            ),
        });
    }

    eq<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>,
    ) {
        return this.next(this.applyFieldOperator(field, { _eq: value }));
    }

    neq<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>,
    ) {
        return this.next(this.applyFieldOperator(field, { _neq: value }));
    }

    in<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>[],
    ) {
        return this.next(this.applyFieldOperator(field, { _in: value }));
    }

    nin<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>[],
    ) {
        return this.next(this.applyFieldOperator(field, { _nin: value }));
    }

    gt<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>,
        including: boolean = false,
    ) {
        const op = including ? "_gte" : "_gt";
        return this.next(this.applyFieldOperator(field, { [op]: value }));
    }

    lt<F extends TableColumn<S, T>>(
        field: F,
        value: NonNullable<TableRow<S, T>[F]>,
        including: boolean = false,
    ) {
        const op = including ? "_lte" : "_lt";
        return this.next(this.applyFieldOperator(field, { [op]: value }));
    }

    like(
        field: StringColumn<S, T>,
        value: string,
        caseSensitive: boolean = false,
    ) {
        const op = caseSensitive ? "_like" : "_ilike";
        return this.next(this.applyFieldOperator(field, { [op]: value }));
    }

    nlike(
        field: StringColumn<S, T>,
        value: string,
        caseSensitive: boolean = false,
    ) {
        const op = caseSensitive ? "_nlike" : "_nilike";
        return this.next(this.applyFieldOperator(field, { [op]: value }));
    }

    isNull(field: TableColumn<S, T>, value: boolean) {
        return this.next(this.applyFieldOperator(field, { _is_null: value }));
    }

    id(value: PK) {
        if (this.state.primaryKey === null) {
            throw new Error(
                `${this.state.table} has no primary key configured`,
            );
        }
        return this.next(
            this.applyFieldOperator(this.state.primaryKey, { _eq: value }),
        );
    }

    order(order: OrderBy<S, T>) {
        return this.next({ order });
    }

    offset(offset: number) {
        return this.next({ offset });
    }

    limit(limit: number) {
        return this.next({ limit });
    }

    distinctOn(column: TableColumn<S, T>) {
        return this.next({ distinctOn: column });
    }

    select<G extends string>(
        graph:
            & G
            & (ValidateSelection<G, S, T> extends true ? unknown
                : never),
    ) {
        return this.next<GetSelectionType<G, S, T>>({ selection: graph });
    }

    customSelect<Custom extends object>(graph: string) {
        return this.next<Custom>({ selection: graph });
    }

    all() {
        return this.next<V, false, false>({ mode: "list" });
    }

    one() {
        return this.next<V, true, true>({ mode: "single" });
    }

    insert(data: Insert | Insert[]) {
        return this.next<V, false, false>({ mode: "insert", data });
    }

    onConflict(conflict: ConflictSpec | false) {
        return this.next({ conflict });
    }

    update(data: Partial<Insert>) {
        return this.next<{ affected_rows: number; }, true, false>({
            mode: "update",
            data,
        });
    }

    remove() {
        return this.next<{ affected_rows: number; }, true, false>({
            mode: "remove",
        });
    }

    aggregate<
        const Agg extends {
            aggregate?: TableAggregateInput<S, T>;
            nodes?: NonEmptyArray<TableColumn<S, T>>;
        },
    >(agg: Agg) {
        return this.next<AggregateResult<S, T, Agg>, true, false>({
            mode: "aggregate",
            agg: agg as BuilderState["agg"],
        });
    }

    count() {
        return this.aggregate({ aggregate: { count: true } });
    }

    /** True when this builder targets an aggregate query (mode "aggregate").
     * Lets a consumer branch on query shape — e.g. seed an empty aggregate
     * object vs an empty list before the first result arrives. */
    isAggregate(): boolean {
        return this.state.mode === "aggregate";
    }

    subscribe(
        next: (data: Result) => void,
        error?: (error: unknown) => void,
    ): () => void {
        const subscribeFn = this.state.executor.subscribe;
        if (!subscribeFn) {
            throw new Error("executor.subscribe is not configured");
        }
        if (
            this.state.mode === "insert" || this.state.mode === "update"
            || this.state.mode === "remove"
        ) {
            throw new Error("subscribe() supports list and aggregate modes");
        }
        const request = this.buildRequest("subscription");
        return subscribeFn(request, {
            next: (data) => {
                // Partial/errored frames can carry root data WITHOUT the
                // subscribed field. Unwrapping those would fabricate an
                // empty result (or throw, for aggregates) and clobber the
                // caller's last good payload — deliver only frames that
                // actually contain the field.
                const rootKey = request.resultPath?.[0];
                const rootData = data as Record<string, unknown>;
                if (
                    data === null || data === undefined
                    || typeof data !== "object"
                    || (rootKey !== undefined
                        && (!(rootKey in rootData)
                            || rootData[rootKey] === null
                            || rootData[rootKey] === undefined))
                ) {
                    return;
                }
                next(
                    this.unwrap(
                        extractResult(data, request.resultPath),
                    ) as Result,
                );
            },
            error,
        });
    }

    then<TResult1 = Result, TResult2 = never>(
        onfulfilled?:
            | ((value: Result) => TResult1 | PromiseLike<TResult1>)
            | null,
        onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
    ): PromiseLike<TResult1 | TResult2> {
        return this.run().then(onfulfilled, onrejected);
    }

    /** Run the operation and resolve BOTH the unwrapped payload and the
     *  GraphQL response error, if any. The plain awaited path (`then`)
     *  resolves the payload alone and cannot distinguish a failed operation
     *  from an empty result — call-sites that need to branch on failure opt
     *  into this accessor. The executor owns error reporting; `error` here
     *  is purely for the call-site's decision. */
    async response(): Promise<{ data: Result; error: unknown; }> {
        const request = this.buildRequest();
        const result = await this.state.executor.execute(request);
        return {
            data: this.unwrap(
                extractResult(result.data, request.resultPath),
            ) as Result,
            error: result.error ?? null,
        };
    }

    private async run(): Promise<Result> {
        return (await this.response()).data;
    }

    private unwrap(payload: unknown): unknown {
        switch (this.state.mode) {
            case "single":
                // Executors resolving through an object-valued field (e.g. a
                // *_by_pk-style resultPath) hand over a bare row, not a list.
                return Array.isArray(payload)
                    ? payload[0] ?? null
                    : payload ?? null;
            case "list":
                return payload ?? [];
            default:
                // GraphQL execution errors are exposed through response(). Keep
                // the plain awaited path compatible with 1.0.x by resolving the
                // mode's empty value instead of converting a response error into
                // a rejection. insert returns a list; mutation/aggregate modes
                // return null when their payload is absent.
                return this.state.mode === "insert"
                    ? (payload ?? [])
                    : (payload ?? null);
        }
    }

    /** An empty _bool_exp matches every row, so a `{}` where must not
     * satisfy the whole-table mutation guard any more than a missing one. */
    private hasWhereFilter(): boolean {
        return this.state.where !== undefined
            && Object.keys(this.state.where).length > 0;
    }

    private requireSelection(): string {
        if (this.state.selection === null) {
            throw new Error(
                `No selection for table "${this.state.table}": call `
                    + "select()/customSelect() or configure defaultSelections",
            );
        }
        return this.state.selection;
    }

    private buildRequest(
        listKind: "query" | "subscription" = "query",
    ): GraphQLRequest {
        const state = this.state;
        switch (state.mode) {
            case "list":
            case "single":
                return buildListRequest({
                    table: state.table,
                    selection: this.requireSelection(),
                    where: state.where,
                    order: state.order,
                    offset: state.offset,
                    limit: state.mode === "single" ? 1 : state.limit,
                    distinctOn: state.distinctOn,
                    kind: listKind,
                });
            case "aggregate":
                return buildAggregateRequest({
                    table: state.table,
                    aggregate: state.agg?.aggregate,
                    nodes: state.agg?.nodes,
                    where: state.where,
                    order: state.order,
                    offset: state.offset,
                    limit: state.limit,
                    distinctOn: state.distinctOn,
                    kind: listKind,
                });
            case "insert":
                return buildInsertRequest({
                    table: state.table,
                    selection: this.requireSelection(),
                    data: state.data,
                    conflict: state.conflict,
                });
            case "update":
                if (!this.hasWhereFilter()) {
                    throw new Error("update() requires a where filter");
                }
                return buildUpdateRequest({
                    table: state.table,
                    where: state.where,
                    data: state.data,
                });
            case "remove":
                if (!this.hasWhereFilter()) {
                    throw new Error("remove() requires a where filter");
                }
                return buildDeleteRequest({
                    table: state.table,
                    where: state.where,
                });
        }
    }
}
