import { expect, test } from "bun:test";
import { Kind, OperationTypeNode } from "../../src/parsing/ast.js";

test("Kind enum carries GraphQL AST node names", () => {
    expect(Kind.FIELD).toEqual("Field" as Kind);
    expect(Kind.DOCUMENT).toEqual("Document" as Kind);
    expect(Kind.SELECTION_SET).toEqual("SelectionSet" as Kind);
    expect(OperationTypeNode.QUERY).toEqual("query" as OperationTypeNode);
});
