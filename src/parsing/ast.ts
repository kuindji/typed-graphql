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
