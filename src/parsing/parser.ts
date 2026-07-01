import type { GraphQLError } from "../diagnostics.js";
import type { _match, _match2, Kind, OperationTypeNode } from "./ast.js";
import type { Token, tokenize, TokenizeError } from "./tokenize.js";

// ---------------------------------------------------------------------------
// Type-level recursive-descent parser over the token array produced by
// `tokenize` (see ./tokenize.ts). Ported from the reference GraphQL parser
// (ffi-adapted from the Supabase client's type-level GraphQL engine).
//
// Combinator convention: every `takeX<In, ...>` combinator either
//   - matches: returns `_match<Node, Rest>` (or `_match2<...>` when it needs to
//     hand back two independently-inferred values, e.g. an optional alias
//     plus a name), or
//   - does not match: returns `void`.
// `void` here is a control-flow sentinel ("this production didn't match, try
// the next alternative"), not an error — exactly like the tokenizer's
// `skipFloat`. It must not be turned into a diagnostic; callers branch on it
// with `extends _match<...> ? ... : <try next production>`.
//
// Hardening (this task, vs. the reference): the two *public* entry points
// (`ParseDocument`, `ParseSelection`) additionally (a) propagate a
// `TokenizeError` from the tokenizer as a `GraphQLError`, and (b) require the
// leftover token stream after parsing to be `[]` — i.e. the whole input must
// be consumed, not just a prefix of it. Everything above that boundary
// (all the `take*`/`_take*` combinators) keeps its original `void`-sentinel
// signature unchanged.
// ---------------------------------------------------------------------------

// Optional alias/name: `foo` alone, or nothing at all (e.g. inside a
// fragment spread `... on Type { }` there is no name token to consume).
type takeOptionalName<In extends any[]> = In extends [
    { kind: Token.Name; name: infer Name; },
    ...infer Rest,
] ? _match<{ kind: Kind.NAME; value: Name; }, Rest>
    : _match<undefined, In>;

export type takeValue<In extends any[], Const extends boolean> = In extends
    [ Token.Float, ...infer InFloat ]
    ? _match<{ kind: Kind.FLOAT; value: string; }, InFloat>
    : In extends [ Token.Integer, ...infer InInt ]
        ? _match<{ kind: Kind.INT; value: string; }, InInt>
    : In extends [ Token.String, ...infer InString ]
        ? _match<{ kind: Kind.STRING; value: string; block: false; }, InString>
    : In extends [ Token.BlockString, ...infer InBlockString ] ? _match<
            { kind: Kind.STRING; value: string; block: true; },
            InBlockString
        >
    : In extends [ { kind: Token.Name; name: "null"; }, ...infer InNull ]
        ? _match<{ kind: Kind.NULL; }, InNull>
    : In extends
        [ { kind: Token.Name; name: "true" | "false"; }, ...infer InBoolean ]
        ? _match<{ kind: Kind.BOOLEAN; value: boolean; }, InBoolean>
    : In extends [ { kind: Token.Name; name: infer Name; }, ...infer InName ]
        ? _match<{ kind: Kind.ENUM; value: Name; }, InName>
    : In extends [ Token.BracketOpen, ...infer InBracketOpen ]
        ? takeListRec<[], InBracketOpen, Const>
    : In extends [ Token.BraceOpen, ...infer InBraceOpen ]
        ? takeObjectRec<[], InBraceOpen, Const>
    : Const extends false
        ? In extends [ { kind: Token.Var; name: infer Name; }, ...infer InVar ]
            ? _match<
                {
                    kind: Kind.VARIABLE;
                    name: { kind: Kind.NAME; value: Name; };
                },
                InVar
            >
        : void
    : void;

export type takeString<In extends any[]> = In extends
    [ Token.String, ...infer InString ]
    ? _match<{ kind: Kind.STRING; value: string; block: false; }, InString>
    : In extends [ Token.BlockString, ...infer InBlockString ] ? _match<
            { kind: Kind.STRING; value: string; block: true; },
            InBlockString
        >
    : void;

type takeListRec<Nodes extends any[], In extends any[], Const extends boolean> =
    In extends [
        Token.BracketClose,
        ...infer InBracketClose,
    ] ? _match<{ kind: Kind.LIST; values: Nodes; }, InBracketClose>
        : takeValue<In, Const> extends
            _match<infer Node, infer InNode extends any[]>
            ? takeListRec<[ ...Nodes, Node ], InNode, Const>
        : void;

type takeObjectField<In extends any[], Const extends boolean> = In extends [
    { kind: Token.Name; name: infer FieldName; },
    Token.Colon,
    ...infer InColon,
]
    ? takeValue<InColon, Const> extends
        _match<infer Value, infer InValue extends any[]> ? _match<
            {
                kind: Kind.OBJECT_FIELD;
                name: { kind: Kind.NAME; value: FieldName; };
                value: Value;
            },
            InValue
        >
    : void
    : void;

export type takeObjectRec<
    Fields extends any[],
    In extends any[],
    Const extends boolean,
> = In extends [ Token.BraceClose, ...infer InBraceClose ]
    ? _match<{ kind: Kind.OBJECT; fields: Fields; }, InBraceClose>
    : takeObjectField<In, Const> extends
        _match<infer Field, infer InField extends any[]>
        ? takeObjectRec<[ ...Fields, Field ], InField, Const>
    : void;

type takeArgument<In extends any[], Const extends boolean> = In extends [
    { kind: Token.Name; name: infer ArgName; },
    Token.Colon,
    ...infer InColon,
]
    ? takeValue<InColon, Const> extends
        _match<infer Value, infer InValue extends any[]> ? _match<
            {
                kind: Kind.ARGUMENT;
                name: { kind: Kind.NAME; value: ArgName; };
                value: Value;
            },
            InValue
        >
    : void
    : void;

type _takeArgumentsRec<
    Arguments extends any[],
    In extends any[],
    Const extends boolean,
> = In extends [ Token.ParenClose, ...infer InParenClose ]
    ? _match<Arguments, InParenClose>
    : takeArgument<In, Const> extends
        _match<infer Argument, infer InArgument extends any[]>
        ? _takeArgumentsRec<[ ...Arguments, Argument ], InArgument, Const>
    : void;

export type takeArguments<In extends any[], Const extends boolean> = In extends
    [
        Token.ParenOpen,
        ...infer In,
    ] ? _takeArgumentsRec<[], In, Const>
    : _match<[], In>;

export type takeDirective<In extends any[], Const extends boolean> = In extends
    [
        { kind: Token.Directive; name: infer DirectiveName; },
        ...infer InDirective,
    ]
    ? takeArguments<InDirective, Const> extends
        _match<infer Arguments, infer InArguments extends any[]> ? _match<
            {
                kind: Kind.DIRECTIVE;
                name: { kind: Kind.NAME; value: DirectiveName; };
                arguments: Arguments;
            },
            InArguments
        >
    : void
    : void;

export type takeDirectives<
    In extends any[],
    Const extends boolean,
    Directives extends any[] = [],
> = takeDirective<In, Const> extends
    _match<infer Directive, infer In extends any[]>
    ? takeDirectives<In, Const, [ ...Directives, Directive ]>
    : _match<Directives, In>;

// A field's leading name is ambiguous between a bare name (`foo`) and an
// aliased name (`alias: foo`) until the following token is checked for a
// colon. `_match2` carries both the (possibly `undefined`) alias and the
// resolved field name back to the caller in one shot.
type _takeFieldName<In extends any[]> = In extends [
    { kind: Token.Name; name: infer MaybeAlias; },
    ...infer InMaybeAlias,
] ? InMaybeAlias extends [
        Token.Colon,
        { kind: Token.Name; name: infer Name; },
        ...infer InName,
    ] ? _match2<
            { kind: Kind.NAME; value: MaybeAlias; },
            { kind: Kind.NAME; value: Name; },
            InName
        >
    : _match2<undefined, { kind: Kind.NAME; value: MaybeAlias; }, InMaybeAlias>
    : void;

type _takeField<In extends any[]> = _takeFieldName<In> extends
    _match2<infer Alias, infer Name, infer InAliasName>
    ? takeArguments<InAliasName, false> extends
        _match<infer Arguments, infer InArguments extends any[]>
        ? takeDirectives<InArguments, false> extends
            _match<infer Directives, infer InDirectives extends any[]>
            ? takeSelectionSet<InDirectives> extends
                _match<infer SelectionSet, infer InSelectionSet extends any[]>
                ? _match<
                    {
                        kind: Kind.FIELD;
                        alias: Alias;
                        name: Name;
                        arguments: Arguments;
                        directives: Directives;
                        selectionSet: SelectionSet;
                    },
                    InSelectionSet
                >
            : _match<
                {
                    kind: Kind.FIELD;
                    alias: Alias;
                    name: Name;
                    arguments: Arguments;
                    directives: Directives;
                    selectionSet: undefined;
                },
                InDirectives
            >
        : void
    : void
    : void;

export type takeType<In extends any[]> = In extends
    [ Token.BracketOpen, ...infer InBracketOpen ]
    ? takeType<InBracketOpen> extends
        _match<infer Subtype, infer InSubtype extends any[]>
        ? InSubtype extends [ Token.BracketClose, ...infer InBracketClose ]
            ? InBracketClose extends [ Token.Exclam, ...infer InExclam ]
                ? _match<
                    {
                        kind: Kind.NON_NULL_TYPE;
                        type: { kind: Kind.LIST_TYPE; type: Subtype; };
                    },
                    InExclam
                >
            : _match<{ kind: Kind.LIST_TYPE; type: Subtype; }, InBracketClose>
        : void
    : void
    : In extends [ { kind: Token.Name; name: infer Name; }, ...infer InName ]
        ? InName extends [ Token.Exclam, ...infer InExclam ] ? _match<
                {
                    kind: Kind.NON_NULL_TYPE;
                    type: {
                        kind: Kind.NAMED_TYPE;
                        name: { kind: Kind.NAME; value: Name; };
                    };
                },
                InExclam
            >
        : _match<
            { kind: Kind.NAMED_TYPE; name: { kind: Kind.NAME; value: Name; }; },
            InName
        >
    : void;

type _takeFragmentSpread<In extends any[]> = In extends [
    Token.Spread,
    { kind: Token.Name; name: "on"; },
    { kind: Token.Name; name: infer Type; },
    ...infer InOnType,
]
    ? takeDirectives<InOnType, false> extends
        _match<infer Directives, infer InDirectives extends any[]>
        ? takeSelectionSet<InDirectives> extends
            _match<infer SelectionSet, infer InSelectionSet extends any[]>
            ? _match<
                {
                    kind: Kind.INLINE_FRAGMENT;
                    typeCondition: {
                        kind: Kind.NAMED_TYPE;
                        name: { kind: Kind.NAME; value: Type; };
                    };
                    directives: Directives;
                    selectionSet: SelectionSet;
                },
                InSelectionSet
            >
        : void
    : void
    : In extends [
        Token.Spread,
        { kind: Token.Name; name: infer Name; },
        ...infer InName,
    ]
        ? takeDirectives<InName, false> extends
            _match<infer Directives, infer InDirectives extends any[]> ? _match<
                {
                    kind: Kind.FRAGMENT_SPREAD;
                    name: { kind: Kind.NAME; value: Name; };
                    directives: Directives;
                },
                InDirectives
            >
        : void
    : In extends [ Token.Spread, ...infer InSpread ]
        ? takeDirectives<InSpread, false> extends
            _match<infer Directives, infer InDirectives extends any[]>
            ? takeSelectionSet<InDirectives> extends
                _match<infer SelectionSet, infer InSelectionSet extends any[]>
                ? _match<
                    {
                        kind: Kind.INLINE_FRAGMENT;
                        typeCondition: undefined;
                        directives: Directives;
                        selectionSet: SelectionSet;
                    },
                    InSelectionSet
                >
            : void
        : void
    : void;

type _takeSelectionRec<Selections extends any[], In extends any[]> =
    _takeField<In> extends
        _match<infer Selection, infer InSelectionRec extends any[]>
        ? _takeSelectionRec<[ ...Selections, Selection ], InSelectionRec>
        : _takeFragmentSpread<In> extends
            _match<infer Selection, infer InFragmentSpread extends any[]>
            ? _takeSelectionRec<[ ...Selections, Selection ], InFragmentSpread>
        : In extends [ Token.BraceClose, ...infer InBraceClose ] ? _match<
                { kind: Kind.SELECTION_SET; selections: Selections; },
                InBraceClose
            >
        : void;

export type takeSelectionSet<In extends any[]> = In extends
    [ Token.BraceOpen, ...infer InBraceOpen ]
    ? _takeSelectionRec<[], InBraceOpen>
    : void;

export type takeVarDefinition<In extends any[]> = In extends [
    { kind: Token.Var; name: infer VarName; },
    Token.Colon,
    ...infer InColon,
]
    ? takeType<InColon> extends _match<infer Type, infer InType extends any[]>
        ? InType extends [ Token.Equal, ...infer InEqual ]
            ? takeValue<InEqual, true> extends
                _match<infer DefaultValue, infer InDefaultValue extends any[]>
                ? takeDirectives<InDefaultValue, true> extends
                    _match<infer Directives, infer InDirectives extends any[]>
                    ? _match<
                        {
                            kind: Kind.VARIABLE_DEFINITION;
                            variable: {
                                kind: Kind.VARIABLE;
                                name: { kind: Kind.NAME; value: VarName; };
                            };
                            type: Type;
                            defaultValue: DefaultValue;
                            directives: Directives;
                        },
                        InDirectives
                    >
                : void
            : void
        : takeDirectives<InType, true> extends
            _match<infer Directives, infer InDirectives extends any[]> ? _match<
                {
                    kind: Kind.VARIABLE_DEFINITION;
                    variable: {
                        kind: Kind.VARIABLE;
                        name: { kind: Kind.NAME; value: VarName; };
                    };
                    type: Type;
                    defaultValue: undefined;
                    directives: Directives;
                },
                InDirectives
            >
        : void
    : void
    : void;

type _takeVarDefinitionRec<Definitions extends any[], In extends any[]> =
    In extends [
        Token.ParenClose,
        ...infer In,
    ] ? _match<Definitions, In>
        : takeVarDefinition<In> extends
            _match<infer Definition, infer In extends any[]>
            ? _takeVarDefinitionRec<[ ...Definitions, Definition ], In>
        : takeString<In> extends _match<infer _, infer In extends any[]>
            ? _takeVarDefinitionRec<[ ...Definitions ], In>
        : _match<Definitions, In>;

export type takeVarDefinitions<In extends any[]> = In extends
    [ Token.ParenOpen, ...infer In ] ? _takeVarDefinitionRec<[], In>
    : _match<[], In>;

export type takeFragmentDefinition<In extends any[]> = In extends [
    { kind: Token.Name; name: "fragment"; },
    { kind: Token.Name; name: infer Name; },
    { kind: Token.Name; name: "on"; },
    { kind: Token.Name; name: infer Type; },
    ...infer InFragment,
]
    ? takeDirectives<InFragment, true> extends
        _match<infer Directives, infer InDirectives extends any[]>
        ? takeSelectionSet<InDirectives> extends
            _match<infer SelectionSet, infer InSelectionSet extends any[]>
            ? _match<
                {
                    kind: Kind.FRAGMENT_DEFINITION;
                    name: { kind: Kind.NAME; value: Name; };
                    typeCondition: {
                        kind: Kind.NAMED_TYPE;
                        name: { kind: Kind.NAME; value: Type; };
                    };
                    directives: Directives;
                    selectionSet: SelectionSet;
                },
                InSelectionSet
            >
        : void
    : void
    : void;

type takeOperation<In extends any[]> = In extends
    [ { kind: Token.Name; name: "query"; }, ...infer InQuery ]
    ? _match<OperationTypeNode.QUERY, InQuery>
    : In extends
        [ { kind: Token.Name; name: "mutation"; }, ...infer InMutation ]
        ? _match<OperationTypeNode.MUTATION, InMutation>
    : In extends
        [ { kind: Token.Name; name: "subscription"; }, ...infer InSubscription ]
        ? _match<OperationTypeNode.SUBSCRIPTION, InSubscription>
    : void;

export type takeOperationDefinition<In extends any[]> =
    takeOperation<In> extends
        _match<infer Operation, infer InOperation extends any[]>
        ? takeOptionalName<InOperation> extends
            _match<infer Name, infer InName extends any[]>
            ? takeVarDefinitions<InName> extends _match<
                infer VarDefinitions,
                infer InVarDefinitions extends any[]
            >
                ? takeDirectives<InVarDefinitions, false> extends
                    _match<infer Directives, infer InDirectives extends any[]>
                    ? takeSelectionSet<InDirectives> extends _match<
                        infer SelectionSet,
                        infer InSelectionSet extends any[]
                    > ? _match<
                            {
                                kind: Kind.OPERATION_DEFINITION;
                                operation: Operation;
                                name: Name;
                                variableDefinitions: VarDefinitions;
                                directives: Directives;
                                selectionSet: SelectionSet;
                            },
                            InSelectionSet
                        >
                    : void
                : void
            : void
        : void
        // Shorthand query: no `query`/`mutation`/`subscription` keyword, no
        // name, no variables, no directives — just a bare selection set, e.g.
        // `{ id name }`.
        : takeSelectionSet<In> extends
            _match<infer SelectionSet, infer InSelectionSet extends any[]>
            ? _match<
                {
                    kind: Kind.OPERATION_DEFINITION;
                    operation: OperationTypeNode.QUERY;
                    name: undefined;
                    variableDefinitions: [];
                    directives: [];
                    selectionSet: SelectionSet;
                },
                InSelectionSet
            >
        : void;

// Consumes fragment definitions, operation definitions, and (per the GraphQL
// grammar's leniency here) bare strings between definitions, accumulating
// `Definitions` until nothing more matches. Whatever remains in `In` at that
// point is handed back to the caller — the public entry point below is the
// one that decides whether a nonempty remainder is acceptable.
type _takeDocumentRec<Definitions extends any[], In extends any[]> =
    takeFragmentDefinition<In> extends
        _match<infer Definition, infer In extends any[]>
        ? _takeDocumentRec<[ ...Definitions, Definition ], In>
        : takeOperationDefinition<In> extends
            _match<infer Definition, infer In extends any[]>
            ? _takeDocumentRec<[ ...Definitions, Definition ], In>
        : takeString<In> extends _match<infer _, infer In extends any[]>
            ? _takeDocumentRec<[ ...Definitions ], In>
        : _match<Definitions, In>;

// ---------------------------------------------------------------------------
// Public entry points — hardened vs. the reference.
//
// The reference `parseDocument` matched `_takeDocumentRec<[], tokenize<In>>
// extends _match<[...infer Definitions], any>` — binding the leftover token
// stream to `any` threw it away, so trailing garbage after a well-formed
// document (e.g. `"{ id } }"`) silently parsed as if the extra `}` wasn't
// there. Here the remainder is bound to a real type parameter (`Rest2`) and
// required to be `[]`; a nonempty remainder is reported as an
// `INCOMPLETE_INPUT` diagnostic instead of being discarded.
//
// A tokenizer failure (see ./tokenize.ts) is propagated as a `SYNTAX_ERROR`
// rather than being passed on to the parser, where it would otherwise fail to
// match `any[]` and produce a vaguer diagnostic.
// ---------------------------------------------------------------------------

export type DocumentNodeLike = {
    kind: Kind.DOCUMENT;
    definitions: readonly any[];
};

export type ParseDocument<In extends string> = tokenize<In> extends
    TokenizeError<infer Rest>
    ? GraphQLError<"SYNTAX_ERROR", `unexpected token near: ${Rest}`>
    : tokenize<In> extends infer Toks extends any[]
        ? _takeDocumentRec<[], Toks> extends
            _match<infer Defs extends any[], infer Rest2 extends any[]>
            ? Rest2 extends [] // fully consumed?
                ? Defs extends []
                    ? GraphQLError<"SYNTAX_ERROR", "empty document">
                : { kind: Kind.DOCUMENT; definitions: Defs; }
            : GraphQLError<
                "INCOMPLETE_INPUT",
                "unconsumed tokens after document"
            >
        : GraphQLError<"SYNTAX_ERROR", "could not parse document">
    : GraphQLError<"SYNTAX_ERROR", "could not tokenize document">;

// `ParseSelection` parses a *bare* selection (no surrounding braces, e.g. the
// body one would write inside `{ ... }`) by appending a synthetic
// `Token.BraceClose` so `_takeSelectionRec` has something to terminate on,
// then requiring that synthetic close to be the last token consumed — i.e.
// nothing of the real input may remain unconsumed either.
export type ParseSelection<In extends string> = tokenize<In> extends
    TokenizeError<infer Rest>
    ? GraphQLError<"SYNTAX_ERROR", `unexpected token near: ${Rest}`>
    : tokenize<In> extends infer Toks extends any[]
        ? _takeSelectionRec<[], [ ...Toks, Token.BraceClose ]> extends _match<
            { kind: Kind.SELECTION_SET; selections: infer Sels extends any[]; },
            infer Rest2 extends any[]
        > ? Rest2 extends [] ? Sels
            : GraphQLError<
                "INCOMPLETE_INPUT",
                "unconsumed tokens after selection"
            >
        : GraphQLError<"SYNTAX_ERROR", "could not parse selection">
    : GraphQLError<"SYNTAX_ERROR", "could not tokenize selection">;
