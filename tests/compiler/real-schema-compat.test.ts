import { test } from "bun:test";
import { expectTypeOf } from "expect-type";
import type {
    GetReturnType,
    GetSelectionType,
    ValidateGraphQL,
    ValidateSelection,
} from "../../src/index.js";
import type {
    AnonymizedRealSchema,
    AnonymizedRealSchemaStats,
} from "../fixtures/anonymized-real-schema.js";

type Schema = AnonymizedRealSchema;
type Public = Schema["schemas"]["public"];

type RealSizeSelection = `
    f0
    f5
    f14
    f21
    r0 {
        f0
        f1
        f5
        f6
        r0 {
            f0
            f2
            f6
        }
    }
    r2 {
        f0
        f2
        f3
        f4
    }
    r7 {
        f0
        f7
        f15
        r2 {
            f0
            f5
            f6
        }
        r13 {
            f0
            f1
            f7
            f20
            r0 {
                f0
                f1
                f5
            }
        }
    }
`;

test("phase 2 compatibility compiles an anonymized real-size schema", () => {
    expectTypeOf<AnonymizedRealSchemaStats>().toEqualTypeOf<{
        tables: 177;
        fields: 1479;
        relationTables: 128;
        customFields: 70;
    }>();

    type Result = GetSelectionType<RealSizeSelection, Schema, "T48">;

    expectTypeOf<Result>().toEqualTypeOf<{
        f0: Public["T48"]["f0"];
        f5: Public["T48"]["f5"];
        f14: Public["T48"]["f14"];
        f21: Public["T48"]["f21"];
        r0: {
            f0: Public["T142"]["f0"];
            f1: Public["T142"]["f1"];
            f5: Public["T142"]["f5"];
            f6: Public["T142"]["f6"];
            r0: {
                f0: Public["T163"]["f0"];
                f2: Public["T163"]["f2"];
                f6: Public["T163"]["f6"];
            } | null;
        } | null;
        r2: {
            f0: Public["T161"]["f0"];
            f2: Public["T161"]["f2"];
            f3: Public["T161"]["f3"];
            f4: Public["T161"]["f4"];
        } | null;
        r7: {
            f0: Public["T69"]["f0"];
            f7: Public["T69"]["f7"];
            f15: Public["T69"]["f15"];
            r2: {
                f0: Public["T142"]["f0"];
                f5: Public["T142"]["f5"];
                f6: Public["T142"]["f6"];
            };
            r13: {
                f0: Public["T115"]["f0"];
                f1: Public["T115"]["f1"];
                f7: Public["T115"]["f7"];
                f20: Public["T115"]["f20"];
                r0: {
                    f0: Public["T24"]["f0"];
                    f1: Public["T24"]["f1"];
                    f5: Public["T24"]["f5"];
                } | null;
            }[];
        }[];
    }>();
});

test("phase 2 compatibility validates full documents against the real-size schema", () => {
    type Query = `query {
        T48 {
            ${RealSizeSelection}
        }
    }`;

    expectTypeOf<ValidateGraphQL<Query, Schema>>().toEqualTypeOf<true>();
    expectTypeOf<GetReturnType<Query, Schema>>().toEqualTypeOf<{
        T48: GetSelectionType<RealSizeSelection, Schema, "T48">[];
    }>();
});

test("phase 2 compatibility keeps diagnostics stable on the real-size schema", () => {
    expectTypeOf<ValidateSelection<"f0 missing", Schema, "T48">>()
        .toMatchTypeOf<{ code: "UNKNOWN_FIELD"; }>();
});
