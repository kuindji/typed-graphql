import type { GraphQLError } from "../diagnostics.js";
import type { GraphQLInput, GraphQLSchema } from "../schema.js";
import type { ArgumentUses, ValidateArguments } from "./arguments.js";
import type { Compact, Match, SkipIgnored, TakeName, TakeParenthesized } from "./scanner.js";

export interface DirectivesResult<
    Rest extends string,
    Optional extends boolean,
    Uses = never,
> {
    rest: Rest;
    optional: Optional;
    uses: Uses;
}

type DirectiveOptional<Name extends string, Args extends string> =
    Name extends "skip"
        ? Compact<Args> extends "if:false" ? false : true
        : Name extends "include"
            ? Compact<Args> extends "if:true" ? false : true
            : false;

type BuiltInDirectiveArgs<Name extends string> =
    Name extends "skip" | "include"
        ? { if: GraphQLInput<"Boolean!", boolean>; }
        : never;

type DirectiveMeta<
    S extends GraphQLSchema,
    Namespace extends string,
    Name extends string,
> = S extends { directives: infer Directives }
    ? Namespace extends keyof Directives
        ? Name extends keyof Directives[Namespace]
            ? Directives[Namespace][Name]
            : Name extends keyof Directives ? Directives[Name] : never
        : Name extends keyof Directives ? Directives[Name] : never
    : never;

type DirectiveKnown<
    Name extends string,
    S extends GraphQLSchema,
    Namespace extends string,
> = Name extends "skip" | "include" ? true
    : [DirectiveMeta<S, Namespace, Name>] extends [never] ? false : true;

// Built-in @skip/@include are non-repeatable; a schema directive repeats only
// when its meta explicitly opts in with `repeatable: true` (spec §5.7.3).
type DirectiveRepeatable<
    Name extends string,
    S extends GraphQLSchema,
    Namespace extends string,
> = Name extends "skip" | "include" ? false
    : DirectiveMeta<S, Namespace, Name> extends { repeatable: true } ? true
    : false;

type DirectiveArgs<
    Name extends string,
    S extends GraphQLSchema,
    Namespace extends string,
> = Name extends "skip" | "include" ? BuiltInDirectiveArgs<Name>
    : DirectiveMeta<S, Namespace, Name> extends infer Meta
        ? Meta extends { arguments: infer Args } ? Args
        : Meta extends Record<string, GraphQLInput<string, unknown>> ? Meta
        : {}
    : {};

type BuiltInDirectiveLocationAllowed<
    Name extends string,
    Location extends string,
> = Name extends "skip" | "include"
    ? Location extends "FIELD" | "FRAGMENT_SPREAD" | "INLINE_FRAGMENT" ? true : false
    : false;

type DirectiveLocationAllowed<
    Name extends string,
    S extends GraphQLSchema,
    Namespace extends string,
    Location extends string,
> = Name extends "skip" | "include"
    ? BuiltInDirectiveLocationAllowed<Name, Location>
    : DirectiveMeta<S, Namespace, Name> extends { locations: infer Locations extends string }
        ? Location extends Locations ? true : false
        : true;

export type TakeDirectives<
    Source extends string,
    S extends GraphQLSchema,
    Location extends string,
    Namespace extends string,
    Optional extends boolean = false,
    Uses = never,
    Seen = never,
> = SkipIgnored<Source> extends `@${infer Rest}`
    ? TakeName<Rest> extends Match<
        infer Name extends string,
        infer AfterName extends string
    >
        ? DirectiveKnown<Name, S, Namespace> extends true
            ? DirectiveLocationAllowed<Name, S, Namespace, Location> extends true
                ? (DirectiveRepeatable<Name, S, Namespace> extends false
                    ? Name extends Seen ? true : false
                    : false) extends true
                    ? GraphQLError<
                        "DUPLICATE_DIRECTIVE",
                        `directive @${Name} is not repeatable and cannot be used more than once at this location`
                    >
                : SkipIgnored<AfterName> extends `(${string}`
                    ? TakeParenthesized<AfterName> extends Match<
                        infer Args extends string,
                        infer AfterArgs extends string
                    >
                        ? SkipIgnored<Args> extends ""
                            ? GraphQLError<"SYNTAX_ERROR", "argument list cannot be empty">
                        : ValidateArguments<
                            Args,
                            DirectiveArgs<Name, S, Namespace>,
                            S,
                            Namespace
                        > extends infer ValidatedArgs
                            ? ValidatedArgs extends GraphQLError ? ValidatedArgs
                            : TakeDirectives<
                                AfterArgs,
                                S,
                                Location,
                                Namespace,
                                Optional extends true ? true : DirectiveOptional<Name, Args>,
                                Uses | ArgumentUses<ValidatedArgs>,
                                Seen | Name
                            >
                            : never
                        : TakeParenthesized<AfterName>
                    : ValidateArguments<
                        "",
                        DirectiveArgs<Name, S, Namespace>,
                        S,
                        Namespace
                    > extends infer ValidatedArgs
                        ? ValidatedArgs extends GraphQLError ? ValidatedArgs
                        : TakeDirectives<
                            AfterName,
                            S,
                            Location,
                            Namespace,
                            Optional,
                            Uses | ArgumentUses<ValidatedArgs>,
                            Seen | Name
                        >
                        : never
                : GraphQLError<
                    "INVALID_DIRECTIVE_LOCATION",
                    `directive @${Name} cannot be used at ${Location}`
                >
            : GraphQLError<"UNKNOWN_DIRECTIVE", `unknown directive: @${Name}`>
        : TakeName<Rest>
    : DirectivesResult<SkipIgnored<Source>, Optional, Uses>;
