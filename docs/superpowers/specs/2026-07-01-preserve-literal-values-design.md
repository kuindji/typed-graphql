# Preserve literal values through the type-level compiler

Status: superseded by the AST-less compiler rewrite.

The original version of this note targeted the old tokenizer/parser pipeline.
That pipeline no longer exists. Literal handling now lives in
`src/compiler/arguments.ts` and the balanced slice helpers in
`src/compiler/scanner.ts`.

Current contract:

- string, block-string, numeric, boolean, null, enum, list, and object literal
  syntax is validated directly from source slices;
- variable values are collected as `VariableUse<Name, GraphQLInput<Wire, App>>`;
- branded or otherwise narrowed application input types require variables,
  because inline literals cannot prove the narrower TypeScript type.

Future literal work should improve `LiteralCompatible` and `TakeValue` directly
instead of restoring token nodes.
