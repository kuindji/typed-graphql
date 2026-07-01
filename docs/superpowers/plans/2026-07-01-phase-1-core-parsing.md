# typed-graphql Phase 1: Core Parsing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port TheFloorr's type-level GraphQL tokenizer and parser into `@kuindji/typed-graphql`, hardened so malformed input produces an explicit diagnostic instead of a silently-truncated parse.

**Architecture:** A three-stage type-level pipeline lives under `src/parsing/`: `ast.ts` (shared `Kind` enum + node interfaces), `tokenize.ts` (string → token array, failing explicitly), and `parser.ts` (token array → AST, requiring full input consumption). A minimal `src/diagnostics.ts` defines the branded error vocabulary these stages emit. Public entry points `ParseGraphQL` (document) and `ParseSelection` are exposed from `src/index.ts`.

**Tech Stack:** TypeScript 6 (type-level only, no runtime logic in this phase), Bun test runner, NodeNext ESM with explicit `.js` import extensions.

## Global Constraints

- ESM only (`"type": "module"`); explicit `.js` extensions in all relative imports (NodeNext resolution). Copied verbatim from CONTRIBUTING.md.
- The core has **no** runtime or application-framework dependency; no `@common/*` path aliases, no `type-fest`, no Apollo. From GOALS Goal 1.7 and spec §1.
- Tests are `.test.ts` files under `tests/`; type-level assertions are checked by `tsc`. Runtime assertions run under `bun test`. From spec §5.
- Keep the tail-recursive `_state` / `_match` continuation style from the reference — do **not** rewrite into naive recursion (TS recursion-depth risk). From spec §5 risk 1.
- Reference sources (read-only, for porting): `/Users/kuindji/Projects/TheFloorr/monorepo/packages/common/src/graphql/tokenizer.ts` and `parser.ts`.

---

### Task 1: AST vocabulary (`Kind` enum + node interfaces)

Freeze the AST node shapes first so later hardening changes only failure paths, not node shapes (spec §5 risk 2). This is a direct port with no logic.

**Files:**
- Create: `src/parsing/ast.ts`
- Test: `tests/parsing/ast.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `enum Kind` (const-style string enum), `enum OperationTypeNode`, and the node-shape helper types used by the parser. The parser (Task 4) references `Kind.FIELD`, `Kind.NAME`, `Kind.SELECTION_SET`, `Kind.OPERATION_DEFINITION`, `Kind.DOCUMENT`, `Kind.ARGUMENT`, `Kind.DIRECTIVE`, `Kind.VARIABLE`, `Kind.VARIABLE_DEFINITION`, `Kind.NAMED_TYPE`, `Kind.LIST_TYPE`, `Kind.NON_NULL_TYPE`, `Kind.INT`, `Kind.FLOAT`, `Kind.STRING`, `Kind.BOOLEAN`, `Kind.NULL`, `Kind.ENUM`, `Kind.LIST`, `Kind.OBJECT`, `Kind.OBJECT_FIELD`, `Kind.FRAGMENT_SPREAD`, `Kind.INLINE_FRAGMENT`, `Kind.FRAGMENT_DEFINITION`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/parsing/ast.test.ts
import { expect, test } from "bun:test";
import { Kind, OperationTypeNode } from "../../src/parsing/ast.js";

test("Kind enum carries GraphQL AST node names", () => {
    expect(Kind.FIELD).toBe("Field");
    expect(Kind.DOCUMENT).toBe("Document");
    expect(Kind.SELECTION_SET).toBe("SelectionSet");
    expect(OperationTypeNode.QUERY).toBe("query");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/parsing/ast.test.ts`
Expected: FAIL — cannot find module `../../src/parsing/ast.js`.

- [ ] **Step 3: Write minimal implementation**

Port the `Kind` and `OperationTypeNode` enums from the reference `parser.ts` (lines 2–63), but as **runtime `enum`s** (not `declare enum`) so the values exist at runtime for the test above. Node-shape interfaces stay type-only.

```ts
// src/parsing/ast.ts
export enum Kind {
    NAME = "Name",
    DOCUMENT = "Document",
    OPERATION_DEFINITION = "OperationDefinition",
    VARIABLE_DEFINITION = "VariableDefinition",
    SELECTION_SET = "SelectionSet",
    FIELD = "Field",
    ARGUMENT = "Argument",
    FRAGMENT_SPREAD = "FragmentSpread",
    INLINE_FRAGMENT = "InlineFragment",
    FRAGMENT_DEFINITION = "FragmentDefinition",
    VARIABLE = "Variable",
    INT = "IntValue",
    FLOAT = "FloatValue",
    STRING = "StringValue",
    BOOLEAN = "BooleanValue",
    NULL = "NullValue",
    ENUM = "EnumValue",
    LIST = "ListValue",
    OBJECT = "ObjectValue",
    OBJECT_FIELD = "ObjectField",
    DIRECTIVE = "Directive",
    NAMED_TYPE = "NamedType",
    LIST_TYPE = "ListType",
    NON_NULL_TYPE = "NonNullType",
}

export enum OperationTypeNode {
    QUERY = "query",
    MUTATION = "mutation",
    SUBSCRIPTION = "subscription",
}

// Shared continuation shapes used by tokenizer + parser.
export interface _match<Out, In extends any[]> {
    out: Out;
    in: In;
}
export interface _match2<Out1, Out2, In extends any[]> {
    out1: Out1;
    out2: Out2;
    in: In;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/parsing/ast.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/parsing/ast.ts tests/parsing/ast.test.ts
git commit -m "feat(parsing): add AST Kind enum and continuation shapes"
```

---

### Task 2: Diagnostics vocabulary

The branded error type + the parse-stage codes. Phase 2 extends this file with validation codes; this task adds only what parsing emits.

**Files:**
- Create: `src/diagnostics.ts`
- Test: `tests/diagnostics.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `interface GraphQLError<Code, Msg, Path>`; type `IsGraphQLError<T>`; the tokenizer/parser reference these to signal failure.

- [ ] **Step 1: Write the failing test**

```ts
// tests/diagnostics.test.ts
import { expect, test } from "bun:test";
import { makeError } from "../src/diagnostics.js";

test("makeError brands a diagnostic with code and message", () => {
    const e = makeError("SYNTAX_ERROR", "unexpected token");
    expect(e.__graphqlError).toBe(true);
    expect(e.code).toBe("SYNTAX_ERROR");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/diagnostics.test.ts`
Expected: FAIL — cannot find module `../src/diagnostics.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/diagnostics.ts

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/diagnostics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/diagnostics.ts tests/diagnostics.test.ts
git commit -m "feat: add branded GraphQLError diagnostics vocabulary"
```

---

### Task 3: Tokenizer port + explicit-failure hardening

Port the reference tokenizer, replacing every "no rule matched" `void` fall-through with a `TokenizeError<Rest>` marker that carries the unconsumed remainder. The `skipFloat` `void` is **control flow, not an error** (it discriminates integer vs float) and must be preserved as `void`.

**Files:**
- Create: `src/parsing/tokenize.ts`
- Test: `tests/parsing/tokenize.test.ts`

**Interfaces:**
- Consumes: nothing (self-contained; `Token` enum defined here).
- Produces: `enum Token`; `interface TokenizeError<Rest>`; interfaces `NameTokenNode<Name>`, `VarTokenNode<Name>`, `DirectiveTokenNode<Name>`; type `TokenNode`; type `tokenize<In extends string>` → `TokenNode[] | TokenizeError`. Task 4 consumes `Token`, `TokenNode`, `tokenize`, and the `*TokenNode` shapes.

- [ ] **Step 1: Write the failing test**

```ts
// tests/parsing/tokenize.test.ts
import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type { tokenize, TokenizeError } from "../../src/parsing/tokenize.js";

test("tokenizer type-level behavior", () => {
    // A well-formed selection tokenizes to a non-error array.
    type Good = tokenize<"{ id name }">;
    expectTypeOf<Good extends TokenizeError ? true : false>().toEqualTypeOf<false>();

    // A stray unmatched character fails explicitly, carrying the remainder.
    type Bad = tokenize<"{ id % }">;
    expectTypeOf<Bad extends TokenizeError ? true : false>().toEqualTypeOf<true>();
});
```

Note: add `expect-type` as a devDependency in this step (`bun add -d expect-type`); it is a pure type-level assertion helper with no runtime footprint.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run typecheck`
Expected: FAIL — cannot find module `../../src/parsing/tokenize.js`.

- [ ] **Step 3: Write minimal implementation**

Port `tokenizer.ts` verbatim for the `Token` enum, `ignored`/`digit`/`letter` unions, `skipIgnored`/`skipDigits`/`skipFloat`/`skipBlockString`/`skipString`/`takeNameLiteralRec`, and the token-node interfaces (reference lines 1–143). Then harden `tokenizeRec`:

```ts
// src/parsing/tokenize.ts — hardened tail of the module
// (Ports reference lines 1–143 unchanged above this point: Token enum,
//  _match, ignored/digit/letter, skip* helpers, takeNameLiteralRec,
//  *TokenNode interfaces, TokenNode, _state.)

export interface TokenizeError<Rest extends string = string> {
    readonly __tokenizeError: true;
    rest: Rest;
}

// prettier-ignore
type tokenizeRec<State> =
    State extends TokenizeError ? State
    : State extends _state<"", any> ? State["out"]
    : State extends _state<infer In, infer Out> ? tokenizeRec<
        In extends `#${string}` ? _state<skipIgnored<In>, Out>
        : In extends `${ignored}${string}` ? _state<skipIgnored<In>, Out>
        : In extends `...${infer R}` ? _state<R, [ ...Out, Token.Spread ]>
        : In extends `!${infer R}` ? _state<R, [ ...Out, Token.Exclam ]>
        : In extends `=${infer R}` ? _state<R, [ ...Out, Token.Equal ]>
        : In extends `:${infer R}` ? _state<R, [ ...Out, Token.Colon ]>
        : In extends `{${infer R}` ? _state<R, [ ...Out, Token.BraceOpen ]>
        : In extends `}${infer R}` ? _state<R, [ ...Out, Token.BraceClose ]>
        : In extends `(${infer R}` ? _state<R, [ ...Out, Token.ParenOpen ]>
        : In extends `)${infer R}` ? _state<R, [ ...Out, Token.ParenClose ]>
        : In extends `[${infer R}` ? _state<R, [ ...Out, Token.BracketOpen ]>
        : In extends `]${infer R}` ? _state<R, [ ...Out, Token.BracketClose ]>
        : In extends `"""${infer R}` ? _state<skipBlockString<R>, [ ...Out, Token.BlockString ]>
        : In extends `"${infer R}` ? _state<skipString<R>, [ ...Out, Token.String ]>
        : In extends `-${digit}${infer R}`
            ? (skipFloat<skipDigits<R>> extends `${infer R2}`
                ? _state<R2, [ ...Out, Token.Float ]>
                : _state<skipDigits<R>, [ ...Out, Token.Integer ]>)
        : In extends `${digit}${infer R}`
            ? (skipFloat<skipDigits<R>> extends `${infer R2}`
                ? _state<R2, [ ...Out, Token.Float ]>
                : _state<skipDigits<R>, [ ...Out, Token.Integer ]>)
        : In extends `$${infer R}`
            ? (takeNameLiteralRec<"", R> extends _match<infer Match, infer R2>
                ? _state<R2, [ ...Out, VarTokenNode<Match & string> ]>
                : TokenizeError<In>)
        : In extends `@${infer R}`
            ? (takeNameLiteralRec<"", R> extends _match<infer Match, infer R2>
                ? _state<R2, [ ...Out, DirectiveTokenNode<Match & string> ]>
                : TokenizeError<In>)
        : In extends `${letter | "_"}${string}`
            ? (takeNameLiteralRec<"", In> extends _match<infer Match, infer R2>
                ? _state<R2, [ ...Out, NameTokenNode<Match & string> ]>
                : TokenizeError<In>)
        : TokenizeError<In>
      >
    : [];

export type tokenize<In extends string> = tokenizeRec<_state<In, []>>;
```

The three changes vs the reference: (a) a leading `State extends TokenizeError ? State` clause so an error short-circuits the whole recursion; (b) the three inner `void`s (failed `$`/`@`/name literals) and (c) the final `: void` become `TokenizeError<In>`. The `_match` here is imported from `./ast.js` — remove the local `_match` copy and `import type { _match } from "./ast.js"` instead. Everything else is the faithful port.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run typecheck`
Expected: no errors (the `Good`/`Bad` assertions hold).

- [ ] **Step 5: Add a negative-corpus assertion for a stray char at the end**

```ts
// append to tests/parsing/tokenize.test.ts
test("tokenizer rejects an unterminated variable sigil", () => {
    type Bad = tokenize<"{ user($) }">;
    expectTypeOf<Bad extends TokenizeError ? true : false>().toEqualTypeOf<true>();
});
```

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/parsing/tokenize.ts tests/parsing/tokenize.test.ts package.json bun.lock
git commit -m "feat(parsing): port tokenizer with explicit TokenizeError failures"
```

---

### Task 4: Parser port + full-consumption hardening

Port the reference recursive-descent parser. Two hardening changes: (a) if `tokenize` produced a `TokenizeError`, propagate it as a parse diagnostic; (b) require the token stream to be **fully consumed** — a non-empty trailing stream becomes an `INCOMPLETE_INPUT` diagnostic instead of being silently discarded.

**Files:**
- Create: `src/parsing/parser.ts`
- Test: `tests/parsing/parser.test.ts`

**Interfaces:**
- Consumes: from `./ast.js` — `Kind`, `OperationTypeNode`, `_match`, `_match2`; from `./tokenize.js` — `Token`, `TokenNode`, `tokenize`, `TokenizeError`; from `../diagnostics.js` — `GraphQLError`.
- Produces: `type ParseDocument<In extends string>` → document AST node `| GraphQLError`; `type ParseSelection<In extends string>` → selection array `| GraphQLError`; `type DocumentNodeLike`. Phase 2 consumes `ParseDocument`, `ParseSelection`, `DocumentNodeLike`, and the AST node shapes.

- [ ] **Step 1: Write the failing test**

```ts
// tests/parsing/parser.test.ts
import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type { ParseDocument, ParseSelection } from "../../src/parsing/parser.js";
import type { GraphQLError } from "../../src/diagnostics.js";

type IsErr<T> = T extends GraphQLError ? true : false;

test("parser accepts valid documents and selections", () => {
    type Doc = ParseDocument<"{ id name }">;
    expectTypeOf<IsErr<Doc>>().toEqualTypeOf<false>();

    type Sel = ParseSelection<"id name user { id }">;
    expectTypeOf<IsErr<Sel>>().toEqualTypeOf<false>();
});

test("parser rejects trailing unconsumed tokens instead of silently truncating", () => {
    // A closing brace with no opener leaves an unconsumed token.
    type Doc = ParseDocument<"{ id } }">;
    expectTypeOf<IsErr<Doc>>().toEqualTypeOf<true>();
});

test("parser propagates tokenizer failure", () => {
    type Doc = ParseDocument<"{ id % }">;
    expectTypeOf<IsErr<Doc>>().toEqualTypeOf<true>();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run typecheck`
Expected: FAIL — cannot find module `../../src/parsing/parser.js`.

- [ ] **Step 3: Write minimal implementation**

Port the reference `parser.ts` combinators unchanged (reference lines 76–513): `takeOptionalName`, `takeValue`, `takeString`, `takeListRec`, `takeObjectField`, `takeObjectRec`, `takeArgument`, `_takeArgumentsRec`, `takeArguments`, `takeDirective`, `takeDirectives`, `_takeFieldName`, `_takeField`, `takeType`, `_takeFragmentSpread`, `_takeSelectionRec`, `takeSelectionSet`, `takeVarDefinition`, `_takeVarDefinitionRec`, `takeVarDefinitions`, `takeFragmentDefinition`, `takeOperation`, `takeOperationDefinition`, `_takeDocumentRec`. Import `Kind`, `OperationTypeNode`, `_match`, `_match2` from `./ast.js` and `Token`, `tokenize`, `TokenizeError` from `./tokenize.js`. Then replace the public entry points (reference lines 515–533) with hardened versions:

```ts
// src/parsing/parser.ts — hardened public entry points
import type { GraphQLError } from "../diagnostics.js";
// ...combinators + `_takeDocumentRec` ported above...

export type DocumentNodeLike = {
    kind: Kind.DOCUMENT;
    definitions: readonly any[];
};

// A parse fails when: the tokenizer errored; OR definitions are empty; OR the
// token stream was not fully consumed (trailing garbage).
export type ParseDocument<In extends string> =
    tokenize<In> extends TokenizeError<infer Rest>
        ? GraphQLError<"SYNTAX_ERROR", `unexpected token near: ${Rest}`>
        : tokenize<In> extends infer Toks extends any[]
            ? _takeDocumentRec<[], Toks> extends _match<infer Defs extends any[], infer Rest2 extends any[]>
                ? Rest2 extends [] // fully consumed?
                    ? Defs extends [] ? GraphQLError<"SYNTAX_ERROR", "empty document">
                        : { kind: Kind.DOCUMENT; definitions: Defs }
                    : GraphQLError<"INCOMPLETE_INPUT", "unconsumed tokens after document">
                : GraphQLError<"SYNTAX_ERROR", "could not parse document">
            : GraphQLError<"SYNTAX_ERROR", "could not tokenize document">;

// Partial selection: append a synthetic BraceClose so `_takeSelectionRec`
// terminates, then require the synthetic close to be the last consumed token.
export type ParseSelection<In extends string> =
    tokenize<In> extends TokenizeError<infer Rest>
        ? GraphQLError<"SYNTAX_ERROR", `unexpected token near: ${Rest}`>
        : tokenize<In> extends infer Toks extends any[]
            ? _takeSelectionRec<[], [ ...Toks, Token.BraceClose ]> extends
                _match<{ kind: Kind.SELECTION_SET; selections: infer Sels extends any[] }, infer Rest2 extends any[]>
                ? Rest2 extends []
                    ? Sels
                    : GraphQLError<"INCOMPLETE_INPUT", "unconsumed tokens after selection">
                : GraphQLError<"SYNTAX_ERROR", "could not parse selection">
            : GraphQLError<"SYNTAX_ERROR", "could not tokenize selection">;
```

Key hardening detail vs the reference: the reference `parseDocument` (line 515) matched `_match<[...infer Definitions], any>` — the `any` **threw away** the remainder `In`, which is exactly the silent-truncation bug. Here we bind it to `Rest2` and require `Rest2 extends []`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run typecheck`
Expected: no errors — all three tests hold.

- [ ] **Step 5: Commit**

```bash
git add src/parsing/parser.ts tests/parsing/parser.test.ts
git commit -m "feat(parsing): port parser with full-consumption hardening"
```

---

### Task 5: Public entry points + positive/negative corpus

Expose `ParseGraphQL` / `ParseSelection` from the package root, and lock in the "reject prefix, don't silently accept" contract with a corpus covering the language surface from spec §3 Task 5.

**Files:**
- Modify: `src/index.ts`
- Test: `tests/parsing/corpus.test.ts`

**Interfaces:**
- Consumes: `ParseDocument`, `ParseSelection` from `./parsing/parser.js`.
- Produces: public `ParseGraphQL<In>` (alias of `ParseDocument`) and re-exported `ParseSelection`, `GraphQLError`, `Kind`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/parsing/corpus.test.ts
import { expectTypeOf } from "expect-type";
import { test } from "bun:test";
import type { ParseGraphQL, ParseSelection } from "../../src/index.js";
import type { GraphQLError } from "../../src/index.js";

type IsErr<T> = T extends GraphQLError ? true : false;

test("positive corpus: representative valid documents parse", () => {
    expectTypeOf<IsErr<ParseGraphQL<"{ id name }">>>().toEqualTypeOf<false>();          // shorthand
    expectTypeOf<IsErr<ParseGraphQL<"query Q { id }">>>().toEqualTypeOf<false>();       // named op
    expectTypeOf<IsErr<ParseGraphQL<"query Q($id: ID!) { user(id: $id) { id } }">>>()
        .toEqualTypeOf<false>();                                                        // vars + args
    expectTypeOf<IsErr<ParseGraphQL<"{ handle: name }">>>().toEqualTypeOf<false>();     // alias
    expectTypeOf<IsErr<ParseGraphQL<"{ id @include(if: true) }">>>().toEqualTypeOf<false>(); // directive
    expectTypeOf<IsErr<ParseGraphQL<"{ ...F } fragment F on User { id }">>>()
        .toEqualTypeOf<false>();                                                        // fragment
    expectTypeOf<IsErr<ParseGraphQL<"mutation { add(x: [1, 2], y: { a: null }) { id } }">>>()
        .toEqualTypeOf<false>();                                                        // list/object/null values
});

test("negative corpus: malformed documents produce diagnostics", () => {
    expectTypeOf<IsErr<ParseGraphQL<"{ id name">>>().toEqualTypeOf<true>();   // unclosed brace
    expectTypeOf<IsErr<ParseGraphQL<"{ id } garbage">>>().toEqualTypeOf<true>(); // trailing garbage
    expectTypeOf<IsErr<ParseGraphQL<"">>>().toEqualTypeOf<true>();            // empty
    expectTypeOf<IsErr<ParseSelection<"id name %">>>().toEqualTypeOf<true>(); // stray char in selection
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run typecheck`
Expected: FAIL — `ParseGraphQL` not exported from `../../src/index.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/index.ts
// @kuindji/typed-graphql — compile-time GraphQL parsing, validation, and
// result-type inference for TypeScript.

export const version = "0.0.0";

export type { ParseSelection } from "./parsing/parser.js";
export type { GraphQLError } from "./diagnostics.js";
export { Kind, OperationTypeNode } from "./parsing/ast.js";

import type { ParseDocument } from "./parsing/parser.js";

// Parse a GraphQL document literal into a type-level AST, or a GraphQLError.
export type ParseGraphQL<In extends string> = ParseDocument<In>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run typecheck`
Expected: no errors — the full positive and negative corpus holds.

- [ ] **Step 5: Run the whole test + typecheck chain**

Run: `npm test`
Expected: `tsc --noEmit` clean, `typecheck:snc` clean, `bun test` all pass (including the runtime `ast`/`diagnostics` tests).

- [ ] **Step 6: Commit**

```bash
git add src/index.ts tests/parsing/corpus.test.ts
git commit -m "feat: expose ParseGraphQL/ParseSelection with parse corpus"
```

---

### Task 6: Perf-budget guard (baseline for the parser)

Port `typed-sql`'s perf-budget harness so subsequent phases gate type-level instantiation growth (spec §5 tooling). Record the Phase 1 baseline.

**Files:**
- Create: `scripts/perf-budget.mjs` (port from `/Users/kuindji/Projects/@kuindji/typed-sql/scripts/perf-budget.mjs`)
- Create: `scripts/perf-baseline.json`
- Modify: `package.json` (add `"perf": "node scripts/perf-budget.mjs"` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run perf` gate (fails when `instantiations`/`types`/`symbols` exceed baseline + 10% headroom).

- [ ] **Step 1: Copy the harness**

Copy `scripts/perf-budget.mjs` from the `typed-sql` path above verbatim; it is project-agnostic (runs `tsc --noEmit --extendedDiagnostics`, compares gated counters to `scripts/perf-baseline.json`).

- [ ] **Step 2: Add the npm script**

Add to `package.json` `scripts`: `"perf": "node scripts/perf-budget.mjs"` and `"perf:update": "node scripts/perf-budget.mjs --update"`.

- [ ] **Step 3: Record the baseline**

Run: `npm run perf:update`
Expected: writes `scripts/perf-baseline.json` with current `instantiations`/`types`/`symbols`.

- [ ] **Step 4: Verify the gate passes against its own baseline**

Run: `npm run perf`
Expected: PASS — counters within baseline + 10%.

- [ ] **Step 5: Commit**

```bash
git add scripts/perf-budget.mjs scripts/perf-baseline.json package.json
git commit -m "chore: add perf-budget guard with Phase 1 baseline"
```

---

## Self-Review

**Spec coverage (spec §3 Phase 1, tasks 1–5):**
- ast.ts port → Task 1. ✓
- tokenizer hardening (no `void` leak) → Task 3. ✓
- parser full-consumption + tokenizer-failure propagation → Task 4. ✓
- `ParseGraphQL` + partial `ParseSelection` entry points → Task 5. ✓
- positive + negative parsing corpus → Tasks 3, 4, 5. ✓
- diagnostics vocabulary (parse codes) → Task 2. ✓
- perf-budget tooling → Task 6. ✓

**Type consistency:** `_match`/`_match2` defined in `ast.ts` (Task 1), consumed in `tokenize.ts` (Task 3) and `parser.ts` (Task 4). `Token`/`TokenNode`/`tokenize`/`TokenizeError` defined in Task 3, consumed in Task 4. `ParseDocument`/`ParseSelection` defined in Task 4, consumed in Task 5. `GraphQLError` defined in Task 2, consumed in Tasks 4–5. Names consistent across tasks.

**Deferred to later phases (not gaps):** schema-aware validation, inference, arguments/variables — Phase 2. Migration corpus — Phase 3. Runtime builder — Phase 4.
