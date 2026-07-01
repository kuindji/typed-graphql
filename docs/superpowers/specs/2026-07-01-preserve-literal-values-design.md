# Preserve literal values through the type-level parser

**Date:** 2026-07-01
**Status:** Approved, ready for implementation
**Scope:** Phase 1 review finding #1 only. Findings #2 (Unicode `\u{...}` /
surrogate escapes) and #3 (`Description?` on operation/fragment definitions) are
confirmed valid but deliberately deferred.

## Problem

The tokenizer emits `Token.String`, `Token.Integer`, `Token.Float`, and
`Token.BlockString` as **bare enum markers with no payload**
(`src/parsing/tokenize.ts:251-262`), unlike `Name`/`Var`/`Directive`, which are
already payload-carrying token nodes. Because the token stream carries no source
text for these kinds, `takeValue` (`src/parsing/parser.ts:37-52`) widens every
literal to `value: string`, and booleans to `value: boolean`. Consequently
`true` and `false` produce the identical AST type
`{ kind: Kind.BOOLEAN; value: boolean }`.

This blocks work required by GOALS.md:235-238 — the first release must infer the
result-shape effect of a **literal** `@skip`/`@include` condition *exactly* — and
the value/range validation planned for Phase 2.

## Decisions

- **Scope:** finding #1 only (preserve literal values). #2 and #3 deferred.
- **Literal form:** **raw source text** — exactly as written, escapes not
  decoded, block strings not dedented. This is a lossless superset; semantic
  processing (escape decoding, block-string dedent) can be layered later without
  re-plumbing. It also avoids pulling a large escape/dedent engine into the type
  system now, which the perf-budget guard (commit `2cc760c`) makes a real risk.
- **Booleans are the exception:** they become exact `true` / `false` literal
  types, since that is the concrete goal from GOALS.md.

## Approach

### 1. Tokenizer (`src/parsing/tokenize.ts`)

Add payload-carrying token nodes mirroring the existing `NameTokenNode`:

```ts
export interface StringTokenNode<V extends string = string>      { kind: Token.String;      value: V }
export interface BlockStringTokenNode<V extends string = string> { kind: Token.BlockString; value: V }
export interface IntTokenNode<V extends string = string>         { kind: Token.Integer;     value: V }
export interface FloatTokenNode<V extends string = string>       { kind: Token.Float;       value: V }
```

Add all four to the `TokenNode` union. The `Token` enum members remain — they are
now the `kind` discriminant on these nodes.

Capture the consumed source text:

- **Strings / block strings.** Convert `skipString` and `skipBlockString` from
  returning just the remainder to accumulator recursion returning
  `_match<RawInner, Rest>` (or `void` on malformed input). They already walk the
  body character by character, so this threads an `Acc` string parameter that
  concatenates each consumed character/escape. This is robust against escaped
  quotes and does not rely on template-literal inference backtracking. The
  captured value is the **raw inner source** between the delimiters.
- **Numbers.** Keep `scanNumber`/`skipIntegerPart`/`scanFractionExponent`
  unchanged. Recover the literal by prefix-subtraction at the tokenizer call
  site: with `scanNumber<In>` yielding `_num<K, R>`, infer
  `` In extends `${infer Val}${R}` `` to get the consumed numeric text `Val`
  (numeric syntax is unambiguous, so the split is safe), then emit
  `K extends Token.Integer ? IntTokenNode<Val> : FloatTokenNode<Val>`.

### 2. Parser (`src/parsing/parser.ts`)

Update `takeValue` and `takeString` to destructure the node payload:

- `{ kind: Token.Float; value: infer V }` → `{ kind: Kind.FLOAT; value: V }`
- `{ kind: Token.Integer; value: infer V }` → `{ kind: Kind.INT; value: V }`
- `{ kind: Token.String; value: infer V }` →
  `{ kind: Kind.STRING; value: V; block: false }`
- `{ kind: Token.BlockString; value: infer V }` →
  `{ kind: Kind.STRING; value: V; block: true }`
- Boolean branch: match `name: infer B extends "true" | "false"` and emit
  `value: B extends "true" ? true : false`.

Every other combinator (`takeArgument`, `takeObjectField`, `takeListRec`,
variable default values) flows through `takeValue` unchanged — they simply carry
richer nodes. No `Kind` enum change is needed; all kinds already exist.

### 3. Tests (`tests/parsing/`)

Add type-level assertions:

- `true` infers `value: true`; `false` infers `value: false` (not `boolean`).
- `f(x: 42)` → INT node `value: "42"`; `f(x: -1.5e3)` → FLOAT node `value: "-1.5e3"`.
- `f(s: "hi")` → STRING `value: "hi"`, `block: false`.
- Block string `"""ok"""` → STRING raw inner `value: "ok"`, `block: true`.
- A string with an escaped quote preserves the raw escape in the value.
- Existing tokenize/parser error tests (unterminated strings, malformed numbers,
  invalid escapes) still reject exactly as before.

## Error handling

Unchanged. The scanners still return `void` on malformed input, which the
tokenizer turns into `TokenizeError`. The accumulator refactor preserves every
existing rejection path: invalid escape sequences, non-hex `\uXXXX`, raw line
terminators inside strings, unterminated strings/block strings, and malformed
numbers (leading zero, empty fraction/exponent).

## Verification

- `npm run typecheck` and `bun test` stay green.
- Re-run the perf-budget guard (commit `2cc760c`). The string accumulator adds
  string-concatenation instantiations per character and numbers add one
  prefix-subtraction; the recursion structure is otherwise unchanged, so cost
  should stay comparable. If the guard regresses beyond budget, reconsider the
  string accumulator vs. a single prefix-subtraction over the whole string body.

## Files touched

- `src/parsing/tokenize.ts`
- `src/parsing/parser.ts`
- `tests/parsing/tokenize.test.ts`
- `tests/parsing/parser.test.ts`
