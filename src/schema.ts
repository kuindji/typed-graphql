export interface GraphQLInput<Wire extends string, App = DefaultInputType<Wire>> {
    readonly wire: Wire;
    readonly app?: App;
}

export interface GraphQLRelation<Type extends string = string> {
    type: Type;
    nullable?: boolean;
    multiple?: boolean;
    itemNullable?: boolean;
}

export interface GraphQLAbstractType<
    PossibleTypes extends string = string,
> {
    possibleTypes: PossibleTypes;
}

export interface GraphQLDirective<
    Arguments = Record<string, GraphQLInput<string, unknown>>,
    Locations extends string = string,
> {
    arguments?: Arguments;
    locations?: Locations;
}

export interface GraphQLSchema {
    defaultSchema: string;
    schemas: Record<string, Record<string, Record<string, unknown>>>;
    relations?: Record<string, Record<string, Record<string, GraphQLRelation>>>;
    arguments?: Record<
        string,
        Record<string, Record<string, Record<string, GraphQLInput<string, unknown>>>>
    >;
    rootTypes?: {
        query?: string;
        mutation?: string;
        subscription?: string;
    };
    inputs?: Record<string, unknown>;
    scalars?: Record<string, unknown>;
    enums?: Record<string, unknown>;
    interfaces?: Record<string, unknown>;
    unions?: Record<string, unknown>;
    directives?: Record<string, unknown>;
}

type StripNonNull<T extends string> = T extends `${infer Inner}!` ? Inner : T;

export type DefaultInputType<Wire extends string> =
    StripNonNull<Wire> extends `[${infer Inner}]`
        ? DefaultInputType<Inner>[]
        : StripNonNull<Wire> extends "Int" | "Float" ? number
        : StripNonNull<Wire> extends "Boolean" ? boolean
        : StripNonNull<Wire> extends "ID" | "String" ? string
        : unknown;

export type InputApplicationType<T> =
    T extends GraphQLInput<string, infer App> ? App : never;
