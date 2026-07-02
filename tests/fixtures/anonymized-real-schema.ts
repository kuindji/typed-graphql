/**
 * Anonymized real-size compatibility schema.
 *
 * This fixture preserves the generated schema scale, field nullability, branded
 * identifiers, custom scalar placeholders, and relation topology from a large
 * production GraphQL surface while replacing domain names with stable anonymous
 * table, field, and relation identifiers. Keep business-specific names out of
 * this file.
 */

type Brand<Name extends string> = string & { readonly __table: Name; };
type Custom<Name extends string> = { readonly __custom: Name; };
type Json = unknown;

export type AnonymizedRealSchema = {
    defaultSchema: "public";
    schemas: {
        public: {
            Query: {};
            T0: {
                f0: Brand<"T0">;
                f1: string;
                f2: string | null;
                f3: boolean | null;
                f4: string;
                f5: Brand<"T142"> | null;
            };
            T1: {
                f0: Brand<"T1">;
                f1: Brand<"T142">;
                f2: string;
                f3: number;
                f4: string;
                f5: string | null;
                f6: string;
            };
            T2: {
                f0: Brand<"T2">;
                f1: string;
                f2: string;
                f3: number;
                f4: string | null;
                f5: string;
            };
            T3: {
                f0: Brand<"T3">;
                f1: string;
                f2: string | null;
                f3: string | null;
                f4: string | null;
                f5: boolean;
            };
            T4: {
                f0: Brand<"T4">;
                f1: string | null;
                f2: string;
                f3: string | null;
                f4: number;
                f5: string | null;
                f6: number;
                f7: string | null;
                f8: string | null;
                f9: boolean;
                f10: boolean;
            };
            T5: {
                f0: Brand<"T5">;
                f1: string;
                f2: Brand<"T4"> | null;
                f3: string;
                f4: string | null;
                f5: boolean;
                f6: boolean;
            };
            T6: {
                f0: Brand<"T5">;
                f1: Brand<"T8">;
                f2: Brand<"T6">;
            };
            T7: {
                f0: Brand<"T7">;
                f1: string;
                f2: string;
                f3: string;
            };
            T8: {
                f0: Brand<"T8">;
                f1: string;
                f2: string;
            };
            T9: {
                f0: Brand<"T9">;
                f1: string;
                f2: string;
                f3: Brand<"T8"> | null;
                f4: boolean;
            };
            T10: {
                f0: Brand<"T10">;
                f1: string;
                f2: string;
                f3: string;
            };
            T11: {
                f0: Brand<"T11">;
                f1: string;
                f2: string;
            };
            T12: {
                f0: Brand<"T12">;
                f1: Brand<"T11"> | null;
                f2: string;
                f3: string;
                f4: boolean;
            };
            T13: {
                f0: Brand<"T13">;
                f1: string;
                f2: string;
                f3: string;
            };
            T14: {
                f0: Brand<"T14">;
                f1: string;
                f2: number | null;
            };
            T15: {
                f0: Brand<"T15">;
                f1: Brand<"T14">;
                f2: string;
            };
            T16: {
                f0: Brand<"T16">;
                f1: Brand<"T14"> | null;
                f2: string;
                f3: boolean;
                f4: string | null;
            };
            T17: {
                f0: Brand<"T17">;
                f1: string;
                f2: string;
                f3: string;
            };
            T18: {
                f0: Brand<"T18">;
                f1: Brand<"T14">;
                f2: number;
            };
            T19: {
                f0: Brand<"T19">;
                f1: string;
                f2: string;
            };
            T20: {
                f0: Brand<"T20">;
                f1: string;
                f2: Brand<"T19"> | null;
                f3: string;
                f4: boolean;
            };
            T21: {
                f0: Brand<"T21">;
                f1: string;
                f2: string;
                f3: string;
            };
            T22: {
                f0: Brand<"T22">;
                f1: string;
                f2: string;
                f3: string;
                f4: string;
                f5: string;
                f6: string;
                f7: string;
                f8: number;
                f9: number;
                f10: string;
                f11: string;
                f12: string;
                f13: string;
                f14: string;
                f15: string;
                f16: boolean;
                f17: string | null;
                f18: string | null;
                f19: string | null;
            };
            T23: {
                f0: Brand<"T23">;
                f1: Brand<"T22">;
                f2: string;
                f3: number;
                f4: number;
                f5: string;
                f6: string;
                f7: string;
                f8: string;
                f9: string;
                f10: string;
                f11: string;
                f12: string | null;
            };
            T24: {
                f0: Brand<"T24">;
                f1: Custom<"C0">;
                f2: Custom<"C1">;
                f3: string;
                f4: string | null;
                f5: Custom<"C2">;
                f6: Custom<"C3"> | null;
            };
            T25: {
                f0: Brand<"T25">;
                f1: string;
            };
            T26: {
                f0: Brand<"T26">;
                f1: string;
                f2: string | null;
                f3: string | null;
                f4: Brand<"T27">;
                f5: number;
                f6: number | null;
                f7: string | null;
                f8: string | null;
                f9: string | null;
                f10: string | null;
                f11: number | null;
                f12: string | null;
                f13: string | null;
                f14: string | null;
                f15: boolean;
                f16: boolean;
            };
            T27: {
                f0: Brand<"T27">;
                f1: string;
                f2: string | null;
                f3: string | null;
                f4: boolean;
            };
            T28: {
                f0: Brand<"T28">;
                f1: Brand<"T48"> | null;
                f2: Brand<"T69"> | null;
                f3: string;
                f4: Brand<"T44"> | null;
                f5: Brand<"T135"> | null;
                f6: string | null;
            };
            T29: {
                f0: Brand<"T29">;
                f1: Brand<"T28">;
                f2: Brand<"T32">;
                f3: Brand<"T142">;
                f4: string | null;
                f5: string;
                f6: Brand<"T22"> | null;
                f7: Brand<"T135"> | null;
            };
            T30: {
                f0: Brand<"T30">;
                f1: Brand<"T28">;
                f2: Brand<"T32">;
                f3: Brand<"T142">;
                f4: Brand<"T48">;
                f5: string;
                f6: Brand<"T135"> | null;
            };
            T31: {
                f0: Brand<"T31">;
                f1: Brand<"T28">;
                f2: Brand<"T32">;
                f3: Brand<"T142">;
                f4: string | null;
                f5: string;
                f6: boolean;
                f7: Brand<"T135"> | null;
            };
            T32: {
                f0: Brand<"T32">;
                f1: Brand<"T28">;
                f2: Brand<"T142">;
                f3: string;
                f4: string;
                f5: Brand<"T48"> | null;
                f6: Brand<"T69"> | null;
                f7: Brand<"T115"> | null;
                f8: string | null;
                f9: Brand<"T32"> | null;
                f10: boolean;
                f11: Brand<"T82"> | null;
                f12: string | null;
                f13: number;
                f14: string | null;
                f15: Brand<"T135"> | null;
            };
            T33: {
                f0: Brand<"T33">;
                f1: Brand<"T32">;
                f2: Brand<"T142">;
                f3: boolean;
                f4: string | null;
                f5: boolean;
                f6: string | null;
            };
            T34: {
                f0: Brand<"T34">;
                f1: Brand<"T32">;
                f2: Brand<"T33">;
                f3: boolean;
                f4: string | null;
                f5: string;
            };
            T35: {
                f0: Brand<"T35">;
                f1: Brand<"T32">;
                f2: Brand<"T33">;
                f3: boolean;
                f4: string | null;
                f5: string | null;
                f6: string | null;
            };
            T36: {
                f0: Brand<"T36">;
                f1: Brand<"T32">;
                f2: Brand<"T33">;
                f3: boolean;
                f4: string | null;
                f5: string;
            };
            T37: {
                f0: Brand<"T37">;
                f1: Brand<"T33">;
                f2: Brand<"T32">;
                f3: string;
                f4: string | null;
                f5: string | null;
                f6: string;
                f7: string | null;
            };
            T38: {
                f0: Brand<"T38">;
                f1: Brand<"T32">;
                f2: Brand<"T33">;
                f3: string | null;
                f4: string | null;
                f5: string | null;
                f6: boolean;
                f7: string | null;
                f8: boolean;
                f9: string | null;
            };
            T39: {
                f0: Brand<"T39">;
                f1: Brand<"T28">;
                f2: Brand<"T32">;
                f3: Brand<"T142">;
                f4: Brand<"T24">;
                f5: string;
                f6: Brand<"T135"> | null;
            };
            T40: {
                f0: Brand<"T40">;
                f1: Brand<"T28">;
                f2: Brand<"T32">;
                f3: Brand<"T142">;
                f4: string;
                f5: string;
            };
            T41: {
                f0: Brand<"T41">;
                f1: Brand<"T142">;
                f2: Brand<"T28">;
                f3: string | null;
                f4: Custom<"C4"> | null;
                f5: string | null;
                f6: string | null;
                f7: string | null;
                f8: Brand<"T135"> | null;
                f9: string | null;
            };
            T42: {
                f0: Brand<"T42">;
                f1: Brand<"T28">;
                f2: Brand<"T32">;
                f3: Brand<"T142">;
                f4: string;
                f5: string;
                f6: number;
                f7: number;
                f8: boolean;
                f9: Brand<"T135"> | null;
            };
            T43: {
                f0: Brand<"T43">;
                f1: string;
                f2: string;
                f3: Brand<"T142"> | null;
                f4: Brand<"T28"> | null;
                f5: string | null;
                f6: string;
                f7: string;
                f8: boolean | null;
            };
            T44: {
                f0: Brand<"T44">;
                f1: string;
                f2: boolean;
                f3: string | null;
            };
            T45: {
                f0: Brand<"T45">;
                f1: Brand<"T44">;
                f2: Brand<"T69">;
                f3: string;
            };
            T46: {
                f0: Brand<"T46">;
                f1: Brand<"T142">;
                f2: Custom<"C5">;
                f3: Brand<"T44">;
            };
            T47: {
                f0: Brand<"T47">;
                f1: Brand<"T142">;
                f2: Brand<"T142">;
                f3: string;
            };
            T48: {
                f0: Brand<"T48">;
                f1: number;
                f2: string | null;
                f3: string | null;
                f4: string | null;
                f5: Custom<"C6">;
                f6: string | null;
                f7: Brand<"T142"> | null;
                f8: Brand<"T142"> | null;
                f9: string;
                f10: string;
                f11: string | null;
                f12: string | null;
                f13: string | null;
                f14: string | null;
                f15: string;
                f16: Brand<"T161"> | null;
                f17: string;
                f18: string | null;
                f19: number;
                f20: string | null;
                f21: boolean;
                f22: string | null;
                f23: Brand<"T135"> | null;
            };
            T49: {
                f0: Brand<"T49">;
                f1: Brand<"T48">;
                f2: Brand<"T151">;
            };
            T50: {
                f0: Brand<"T50">;
                f1: Brand<"T115">;
                f2: Brand<"T142">;
                f3: string;
                f4: string;
                f5: Brand<"T48">;
            };
            T51: {
                f0: Brand<"T51">;
                f1: Brand<"T48">;
                f2: string;
                f3: string;
                f4: string | null;
                f5: number;
                f6: string | null;
            };
            T52: {
                f0: Brand<"T52">;
                f1: Brand<"T48">;
                f2: Brand<"T171">;
            };
            T53: {
                f0: Brand<"T53">;
                f1: Brand<"T48">;
                f2: Brand<"T69"> | null;
                f3: Brand<"T142"> | null;
                f4: Brand<"T142"> | null;
                f5: string;
                f6: string;
                f7: string;
            };
            T54: {
                f0: Brand<"T54">;
                f1: Brand<"T142">;
                f2: string | null;
                f3: string;
            };
            T55: {
                f0: Brand<"T55">;
                f1: Brand<"T142">;
                f2: Brand<"T48">;
                f3: string;
                f4: string;
            };
            T56: {
                f0: Brand<"T56">;
                f1: string;
                f2: string;
                f3: string | null;
                f4: string | null;
                f5: string;
                f6: Brand<"T142"> | null;
            };
            T57: {
                f0: Brand<"T57">;
                f1: Brand<"T56"> | null;
                f2: string;
                f3: string | null;
                f4: string | null;
                f5: string;
                f6: string;
                f7: string;
                f8: Brand<"T142"> | null;
            };
            T58: {
                f0: Brand<"T58">;
                f1: string;
                f2: string;
                f3: boolean;
                f4: string | null;
                f5: string | null;
            };
            T59: {
                f0: Brand<"T59">;
                f1: string;
                f2: number;
                f3: string;
            };
            T60: {
                f0: Brand<"T60">;
                f1: string;
                f2: string;
                f3: number;
            };
            T61: {
                f0: Brand<"T61">;
                f1: string;
                f2: string | null;
                f3: string;
                f4: string | null;
            };
            T62: {
                f0: Brand<"T62">;
                f1: string | null;
                f2: string;
                f3: boolean;
                f4: boolean;
                f5: string | null;
                f6: Brand<"T142"> | null;
                f7: Brand<"T48"> | null;
                f8: string | null;
                f9: string | null;
                f10: boolean;
                f11: string | null;
                f12: string | null;
                f13: string | null;
                f14: Brand<"T142"> | null;
                f15: string | null;
                f16: boolean;
                f17: boolean;
            };
            T63: {
                f0: Brand<"T63">;
                f1: string;
                f2: Custom<"C7"> | null;
                f3: Custom<"C8"> | null;
                f4: string | null;
                f5: Custom<"C9"> | null;
                f6: string;
                f7: string | null;
                f8: string | null;
                f9: string | null;
                f10: string | null;
                f11: Custom<"C10"> | null;
                f12: Brand<"T24"> | null;
                f13: Custom<"C11"> | null;
            };
            T64: {
                f0: Brand<"T64">;
                f1: string;
                f2: string;
                f3: boolean;
                f4: string | null;
                f5: string | null;
            };
            T65: {
                f0: Brand<"T65">;
                f1: Brand<"T69">;
                f2: Brand<"T142"> | null;
                f3: string;
                f4: string | null;
            };
            T66: {
                f0: Brand<"T66">;
                f1: string;
                f2: Brand<"T69">;
                f3: Brand<"T142"> | null;
            };
            T67: {
                f0: Brand<"T67">;
                f1: Brand<"T115"> | null;
                f2: string;
                f3: Brand<"T142"> | null;
                f4: Custom<"C12"> | null;
                f5: string | null;
                f6: string | null;
                f7: boolean;
                f8: string | null;
                f9: Custom<"C13"> | null;
                f10: Brand<"T142"> | null;
                f11: Brand<"T63"> | null;
                f12: string | null;
                f13: Brand<"T142"> | null;
                f14: Custom<"C14"> | null;
                f15: Brand<"T135"> | null;
                f16: string | null;
            };
            T68: {
                f0: Brand<"T68">;
                f1: string;
                f2: Brand<"T115">;
                f3: Brand<"T142"> | null;
            };
            T69: {
                f0: Brand<"T69">;
                f1: string;
                f2: string;
                f3: string;
                f4: string;
                f5: Brand<"T142">;
                f6: Brand<"T48"> | null;
                f7: boolean;
                f8: string | null;
                f9: boolean;
                f10: string | null;
                f11: Brand<"T142"> | null;
                f12: Brand<"T142"> | null;
                f13: boolean;
                f14: string | null;
                f15: string | null;
                f16: string | null;
                f17: boolean;
                f18: string | null;
                f19: Custom<"C15">;
                f20: number;
                f21: Brand<"T78"> | null;
                f22: boolean;
                f23: boolean | null;
                f24: string | null;
                f25: string | null;
                f26: Brand<"T135"> | null;
            };
            T70: {
                f0: Brand<"T69">;
                f1: Brand<"T61">;
                f2: number | null;
            };
            T71: {
                f0: Brand<"T64">;
                f1: Brand<"T69">;
                f2: number | null;
            };
            T72: {
                f0: Brand<"T69">;
                f1: Brand<"T113">;
                f2: number | null;
            };
            T73: {
                f0: Brand<"T69">;
                f1: Brand<"T132">;
                f2: number | null;
            };
            T74: {
                f0: Brand<"T74">;
                f1: Brand<"T69">;
                f2: Brand<"T142">;
                f3: string;
            };
            T75: {
                f0: Brand<"T134">;
                f1: Brand<"T69">;
                f2: number | null;
            };
            T76: {
                f0: Brand<"T76">;
                f1: Brand<"T69">;
                f2: Brand<"T142"> | null;
                f3: Brand<"T142"> | null;
                f4: string;
                f5: string;
                f6: string;
                f7: boolean;
            };
            T77: {
                f0: Brand<"T77">;
                f1: Brand<"T142">;
                f2: string | null;
                f3: string | null;
                f4: string;
            };
            T78: {
                f0: Brand<"T78">;
                f1: string;
                f2: string | null;
            };
            T79: {
                f0: Brand<"T79">;
                f1: Brand<"T69">;
                f2: number;
                f3: Brand<"T78">;
            };
            T80: {
                f0: Brand<"T80">;
                f1: Brand<"T69">;
                f2: number | null;
                f3: number | null;
            };
            T81: {
                f0: Brand<"T69">;
                f1: number;
                f2: number;
                f3: number;
                f4: number;
            };
            T82: {
                f0: Brand<"T82">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
                f4: string | null;
                f5: boolean;
                f6: boolean;
                f7: boolean;
                f8: string | null;
                f9: string | null;
                f10: string | null;
                f11: string | null;
                f12: string | null;
                f13: string | null;
                f14: Custom<"C16">;
                f15: Brand<"T135"> | null;
                f16: boolean;
                f17: boolean | null;
                f18: boolean | null;
                f19: string | null;
                f20: boolean;
                f21: string | null;
                f22: boolean;
                f23: string;
            };
            T83: {
                f0: Brand<"T83">;
                f1: Brand<"T82">;
                f2: Brand<"T22">;
                f3: Brand<"T142">;
                f4: string;
                f5: number;
            };
            T84: {
                f0: Brand<"T84">;
                f1: string;
                f2: string;
                f3: string;
                f4: string;
                f5: string;
                f6: string;
                f7: number;
                f8: number;
                f9: string;
                f10: Brand<"T82">;
                f11: string;
            };
            T85: {
                f0: Brand<"T85">;
                f1: Brand<"T82">;
                f2: string;
                f3: string | null;
                f4: Custom<"C17"> | null;
                f5: number;
                f6: string;
                f7: string;
            };
            T86: {
                f0: Brand<"T86">;
                f1: Brand<"T85">;
                f2: Brand<"T87">;
                f3: number;
                f4: string;
            };
            T87: {
                f0: Brand<"T87">;
                f1: Brand<"T82">;
                f2: Brand<"T24">;
                f3: Brand<"T142">;
                f4: string;
                f5: number;
            };
            T88: {
                f0: Brand<"T88">;
                f1: Brand<"T82">;
                f2: Brand<"T142">;
                f3: string;
                f4: Brand<"T135"> | null;
            };
            T89: {
                f0: Brand<"T89">;
                f1: string;
                f2: string | null;
                f3: string | null;
            };
            T90: {
                f0: Brand<"T90">;
                f1: Brand<"T89">;
                f2: Custom<"C12"> | null | null;
                f3: number;
                f4: number;
                f5: string;
                f6: string;
                f7: string;
                f8: string;
                f9: string;
                f10: number;
                f11: string | null;
                f12: number;
                f13: number;
                f14: string | null;
            };
            T91: {
                f0: Brand<"T91">;
                f1: Brand<"T89">;
                f2: Custom<"C12"> | null | null;
                f3: string;
                f4: string;
                f5: string | null;
                f6: string;
                f7: string;
            };
            T92: {
                f0: Brand<"T92">;
                f1: Custom<"C18">;
                f2: Custom<"C19">;
                f3: string;
                f4: Custom<"C12"> | null | null;
                f5: string | null;
                f6: string;
                f7: number;
                f8: number;
                f9: string;
                f10: string;
                f11: string;
                f12: number;
                f13: number;
                f14: number;
                f15: number;
                f16: number;
                f17: string | null;
                f18: number;
                f19: number | null;
                f20: number | null;
                f21: number;
                f22: string | null;
                f23: boolean | null;
                f24: string | null;
                f25: string | null;
                f26: string | null;
                f27: number | null;
                f28: number | null;
                f29: number | null;
                f30: number | null;
                f31: string | null;
                f32: string | null;
                f33: Custom<"C20"> | null;
                f34: Custom<"C21"> | null;
                f35: string | null;
                f36: number;
                f37: Custom<"C22"> | null;
                f38: string | null;
                f39: Custom<"C23"> | null;
                f40: Custom<"C24"> | null;
                f41: number | null;
                f42: number | null;
                f43: boolean;
                f44: boolean;
            };
            T93: {
                f0: Brand<"T93">;
                f1: Custom<"C18">;
                f2: string;
                f3: string;
                f4: string;
                f5: string;
                f6: number;
                f7: string;
                f8: number;
                f9: number;
                f10: number;
                f11: number;
                f12: string;
                f13: string | null;
                f14: string | null;
                f15: string | null;
                f16: string | null;
                f17: string | null;
                f18: string | null;
                f19: string | null;
                f20: string | null;
                f21: number;
                f22: number | null;
                f23: number | null;
                f24: string | null;
                f25: Json;
                f26: string | null;
                f27: string;
            };
            T94: {
                f0: Brand<"T94">;
                f1: Brand<"T93">;
                f2: Custom<"C18">;
                f3: string;
                f4: string;
                f5: string;
                f6: string | null;
                f7: string | null;
                f8: string | null;
                f9: number | null;
                f10: number | null;
                f11: string | null;
                f12: boolean;
                f13: string | null;
                f14: number | null;
                f15: number | null;
                f16: Json;
            };
            T95: {
                f0: Brand<"T95">;
                f1: Custom<"C18">;
                f2: string;
                f3: number;
                f4: number;
                f5: number;
                f6: Custom<"C25">;
                f7: string;
                f8: string | null;
                f9: Custom<"C26"> | null;
                f10: Custom<"C27">;
                f11: Custom<"C28"> | null;
                f12: Custom<"C29"> | null;
                f13: number;
                f14: number;
                f15: number;
                f16: number;
                f17: number;
                f18: Custom<"C30"> | null;
                f19: Custom<"C31"> | null;
                f20: Custom<"C32"> | null;
                f21: number | null;
                f22: number | null;
            };
            T96: {
                f0: Brand<"T96">;
                f1: string;
            };
            T97: {
                f0: Brand<"T97">;
                f1: Brand<"T96">;
                f2: Brand<"T92">;
            };
            T98: {
                f0: Brand<"T98">;
                f1: string;
                f2: Custom<"C18">;
                f3: Brand<"T89">;
                f4: string;
                f5: string;
                f6: string;
            };
            T99: {
                f0: Brand<"T99">;
                f1: Custom<"C18">;
                f2: string;
                f3: string;
                f4: string;
                f5: number;
                f6: Custom<"C33">;
                f7: string;
                f8: number;
                f9: number;
                f10: string;
                f11: string;
                f12: Custom<"C34">;
                f13: Custom<"C35"> | null;
                f14: boolean | null;
                f15: string | null;
                f16: string | null;
                f17: Custom<"C36"> | null;
                f18: Custom<"C37"> | null;
                f19: Custom<"C38"> | null;
                f20: Custom<"C39"> | null;
                f21: number;
                f22: number;
                f23: number;
                f24: number;
                f25: number;
                f26: Custom<"C40"> | null;
                f27: Custom<"C41"> | null;
                f28: Custom<"C42"> | null;
                f29: number | null;
                f30: number | null;
            };
            T100: {
                f0: Brand<"T100">;
                f1: Custom<"C18">;
                f2: string;
                f3: string;
                f4: Custom<"C43">;
            };
            T101: {
                f0: Brand<"T101">;
                f1: Custom<"C18">;
                f2: string;
                f3: number;
                f4: string;
                f5: string;
                f6: number;
                f7: number;
                f8: string;
                f9: string;
                f10: string;
                f11: number;
                f12: number;
                f13: number;
                f14: Custom<"C44">;
                f15: string | null;
                f16: number;
                f17: number;
                f18: Custom<"C45"> | null;
                f19: Custom<"C46"> | null;
                f20: Custom<"C47"> | null;
                f21: Custom<"C48"> | null;
                f22: number;
                f23: string | null;
                f24: Custom<"C49"> | null;
                f25: Custom<"C50"> | null;
                f26: Custom<"C51"> | null;
                f27: number | null;
                f28: number | null;
            };
            T102: {
                f0: Brand<"T102">;
                f1: Brand<"T101"> | null;
                f2: string;
                f3: Custom<"C18">;
                f4: string;
                f5: string;
                f6: string;
                f7: string;
                f8: number;
                f9: number;
                f10: Custom<"C52">;
                f11: number;
                f12: string | null;
            };
            T103: {
                f0: Brand<"T103">;
                f1: Custom<"C53">;
                f2: Custom<"C12"> | null | null;
                f3: Custom<"C18">;
                f4: string;
                f5: string;
                f6: string | null;
                f7: string;
                f8: string | null;
            };
            T104: {
                f0: Brand<"T104">;
                f1: string;
                f2: string | null;
                f3: Json;
                f4: number;
                f5: number;
                f6: string | null;
                f7: string | null;
            };
            T105: {
                f0: Brand<"T105">;
                f1: string;
                f2: string;
                f3: number;
                f4: number;
                f5: Custom<"C54">;
                f6: Brand<"T106"> | null;
            };
            T106: {
                f0: Brand<"T106">;
                f1: string;
            };
            T107: {
                f0: Brand<"T92">;
                f1: Brand<"T105">;
                f2: string;
                f3: boolean;
            };
            T108: {
                f0: Brand<"T108">;
                f1: string;
                f2: string;
                f3: number;
                f4: string;
                f5: string;
                f6: string;
                f7: string;
                f8: number;
                f9: number;
                f10: number;
                f11: number;
                f12: number;
                f13: string | null;
                f14: string | null;
                f15: string | null;
                f16: string;
                f17: string | null;
            };
            T109: {
                f0: Brand<"T109">;
                f1: string;
                f2: number;
                f3: string;
                f4: string;
                f5: number;
                f6: number;
                f7: number;
                f8: number;
                f9: number;
                f10: number;
                f11: string | null;
                f12: string | null;
                f13: number | null;
            };
            T110: {
                f0: Brand<"T110">;
                f1: string;
                f2: string;
                f3: string | null;
                f4: string | null;
                f5: string;
                f6: number;
                f7: string;
            };
            T111: {
                f0: Brand<"T111">;
                f1: string;
                f2: string;
                f3: number;
                f4: string;
                f5: number;
                f6: string;
                f7: string;
                f8: string;
                f9: string;
            };
            T112: {
                f0: Brand<"T112">;
                f1: string | null;
                f2: string;
                f3: string;
                f4: string;
                f5: string;
                f6: string | null;
                f7: string | null;
            };
            T113: {
                f0: Brand<"T113">;
                f1: string;
                f2: string;
                f3: boolean;
                f4: string | null;
                f5: string | null;
            };
            T114: {
                f0: Brand<"T69">;
                f1: Brand<"T142">;
                f2: string;
            };
            T115: {
                f0: Brand<"T115">;
                f1: string | null;
                f2: string;
                f3: string;
                f4: string;
                f5: string | null;
                f6: string;
                f7: number | null;
                f8: string | null;
                f9: Brand<"T69">;
                f10: number;
                f11: string;
                f12: string;
                f13: number | null;
                f14: string | null;
                f15: string | null;
                f16: string | null;
                f17: string | null;
                f18: string | null;
                f19: string | null;
                f20: Brand<"T24"> | null;
            };
            T116: {
                f0: Brand<"T58">;
                f1: Brand<"T115">;
                f2: number | null;
            };
            T117: {
                f0: Brand<"T115">;
                f1: Brand<"T121">;
                f2: number | null;
            };
            T118: {
                f0: Brand<"T118">;
                f1: Brand<"T115">;
                f2: string;
                f3: number;
                f4: string;
                f5: string;
                f6: string;
                f7: string;
                f8: number;
                f9: string;
                f10: string;
                f11: string;
                f12: string | null;
            };
            T119: {
                f0: Brand<"T115">;
                f1: Brand<"T134">;
            };
            T120: {
                f0: Brand<"T120">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
                f4: string | null;
                f5: string | null;
                f6: string | null;
                f7: string | null;
            };
            T121: {
                f0: Brand<"T121">;
                f1: string;
                f2: string;
                f3: boolean;
                f4: string | null;
                f5: string | null;
            };
            T122: {
                f0: Brand<"T122">;
                f1: string;
                f2: string;
                f3: string;
                f4: string;
                f5: string;
                f6: string;
                f7: string | null;
                f8: string;
                f9: string;
                f10: string;
                f11: boolean;
                f12: boolean | null;
                f13: Brand<"T142"> | null;
                f14: string | null;
                f15: string | null;
                f16: string | null;
                f17: string | null;
                f18: boolean;
                f19: string | null;
                f20: string | null;
                f21: boolean;
                f22: string | null;
                f23: number;
            };
            T123: {
                f0: Brand<"T123">;
                f1: string;
                f2: boolean;
                f3: string | null;
                f4: string | null;
                f5: number | null;
                f6: boolean;
            };
            T124: {
                f0: Brand<"T123">;
                f1: string;
                f2: string;
                f3: number;
                f4: number;
                f5: number;
                f6: string;
                f7: string | null;
                f8: number | null;
            };
            T125: {
                f0: string;
                f1: string;
                f2: string;
                f3: number;
                f4: number;
                f5: number;
                f6: string;
                f7: string;
                f8: string;
                f9: Brand<"T125">;
            };
            T126: {
                f0: Brand<"T126">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
                f4: string;
            };
            T127: {
                f0: Brand<"T127">;
                f1: Brand<"T128"> | null;
                f2: string;
                f3: Brand<"T130">;
                f4: number;
                f5: number;
                f6: Brand<"T142"> | null;
                f7: Custom<"C55">;
                f8: string | null;
                f9: string;
            };
            T128: {
                f0: Brand<"T128">;
                f1: Brand<"T142"> | null;
                f2: number;
                f3: string;
                f4: Custom<"C56">;
                f5: string;
                f6: string | null;
                f7: string;
                f8: string | null;
                f9: Custom<"C57"> | null;
                f10: number;
                f11: Brand<"T135"> | null;
            };
            T129: {
                f0: Brand<"T129">;
                f1: Brand<"T128">;
                f2: string;
                f3: string;
            };
            T130: {
                f0: Brand<"T130">;
                f1: Brand<"T128"> | null;
                f2: string;
                f3: Custom<"C58">;
                f4: number;
                f5: number;
                f6: Brand<"T142"> | null;
                f7: Custom<"C59">;
                f8: string | null;
                f9: string;
                f10: Brand<"T135"> | null;
            };
            T131: {
                f0: Brand<"T131">;
                f1: Brand<"T142"> | null;
                f2: string;
                f3: number;
                f4: string;
            };
            T132: {
                f0: Brand<"T132">;
                f1: string;
                f2: string;
                f3: boolean;
                f4: string | null;
                f5: string | null;
            };
            T133: {
                f0: Brand<"T133">;
                f1: Brand<"T142">;
                f2: Brand<"T142">;
                f3: number;
                f4: string;
                f5: string;
                f6: boolean;
            };
            T134: {
                f0: Brand<"T134">;
                f1: string;
                f2: string;
                f3: boolean;
                f4: string | null;
                f5: string | null;
            };
            T135: {
                f0: Brand<"T135">;
                f1: string;
                f2: string;
                f3: Custom<"C60"> | null;
                f4: string;
                f5: string;
                f6: boolean;
            };
            T136: {
                f0: Brand<"T136">;
                f1: Brand<"T135">;
                f2: Brand<"T142">;
                f3: Custom<"C61">;
                f4: string;
                f5: Brand<"T140"> | null;
                f6: boolean;
                f7: Custom<"C62">;
            };
            T137: {
                f0: Brand<"T135">;
                f1: Brand<"T142">;
                f2: number;
                f3: Custom<"C63">;
                f4: string;
                f5: number;
            };
            T138: {
                f0: Brand<"T135">;
                f1: string | null;
                f2: string | null;
                f3: string | null;
                f4: string | null;
                f5: string | null;
                f6: boolean;
                f7: Custom<"C64"> | null;
            };
            T139: {
                f0: Brand<"T139">;
                f1: Brand<"T135">;
                f2: string;
                f3: string;
                f4: string;
            };
            T140: {
                f0: Brand<"T140">;
                f1: Brand<"T135">;
                f2: string;
                f3: string;
                f4: string;
            };
            T141: {
                f0: Brand<"T135">;
                f1: number;
                f2: string;
                f3: Custom<"C65">;
                f4: number;
            };
            T142: {
                f0: Brand<"T142">;
                f1: string | null;
                f2: string | null;
                f3: string | null;
                f4: string | null;
                f5: string | null;
                f6: string | null;
                f7: string;
                f8: string;
                f9: string | null;
                f10: string | null;
                f11: string | null;
                f12: boolean;
                f13: string | null;
                f14: boolean;
                f15: string | null;
                f16: number;
                f17: number;
                f18: string | null;
                f19: boolean;
                f20: Brand<"T62"> | null;
                f21: string | null;
                f22: string | null;
                f23: string | null;
                f24: string | null;
                f25: string | null;
                f26: string | null;
                f27: string | null;
                f28: Custom<"C66"> | null;
            };
            T143: {
                f0: Brand<"T143">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
            };
            T144: {
                f0: Brand<"T142">;
                f1: string | null;
                f2: number;
                f3: number;
                f4: boolean;
                f5: string | null;
                f6: number;
                f7: boolean;
                f8: boolean;
                f9: string | null;
                f10: boolean;
                f11: string | null;
                f12: boolean;
                f13: string | null;
                f14: boolean;
                f15: string | null;
                f16: number;
                f17: boolean;
                f18: number;
                f19: string | null;
                f20: string | null;
                f21: string | null;
                f22: string | null;
                f23: number;
                f24: string | null;
                f25: string | null;
                f26: number;
                f27: string | null;
                f28: string | null;
                f29: string | null;
                f30: string | null;
                f31: number;
                f32: string | null;
                f33: string | null;
                f34: string | null;
                f35: string | null;
                f36: number;
                f37: string | null;
                f38: string | null;
                f39: string | null;
                f40: string | null;
                f41: string | null;
                f42: string | null;
                f43: number;
                f44: number;
                f45: string | null;
                f46: string | null;
                f47: string | null;
                f48: string | null;
                f49: number;
                f50: string | null;
                f51: string | null;
                f52: string | null;
                f53: string | null;
                f54: number;
                f55: number;
                f56: string | null;
                f57: string | null;
                f58: number;
                f59: string | null;
                f60: boolean;
                f61: string | null;
                f62: string | null;
                f63: string | null;
                f64: boolean;
                f65: number;
                f66: boolean;
                f67: boolean;
                f68: boolean;
                f69: boolean;
                f70: string | null;
                f71: boolean;
                f72: boolean;
                f73: boolean;
                f74: boolean;
            };
            T145: {
                f0: Brand<"T145">;
                f1: Brand<"T142"> | null;
                f2: Brand<"T92"> | null;
                f3: number | null;
                f4: number;
                f5: string;
                f6: string | null;
                f7: string;
                f8: boolean;
                f9: string | null;
                f10: Brand<"T128"> | null;
                f11: string | null;
                f12: number;
                f13: Custom<"C67">;
                f14: Brand<"T135"> | null;
            };
            T146: {
                f0: Brand<"T146">;
                f1: Brand<"T145">;
                f2: Brand<"T101"> | null;
                f3: Brand<"T95"> | null;
                f4: Brand<"T99"> | null;
                f5: number;
                f6: number;
                f7: string;
                f8: string;
                f9: Brand<"T93"> | null;
            };
            T147: {
                f0: Brand<"T147">;
                f1: Brand<"T142">;
                f2: Brand<"T3">;
                f3: boolean;
                f4: number;
            };
            T148: {
                f0: Brand<"T148">;
                f1: Brand<"T22">;
                f2: Brand<"T142">;
                f3: string;
                f4: string;
            };
            T149: {
                f0: Brand<"T149">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
                f4: string;
            };
            T150: {
                f0: Brand<"T142">;
                f1: number | null;
                f2: string;
                f3: string;
            };
            T151: {
                f0: Brand<"T151">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
                f4: string;
                f5: string | null;
                f6: boolean;
                f7: boolean;
            };
            T152: {
                f0: Brand<"T142">;
                f1: string;
                f2: string;
                f3: string;
                f4: string;
            };
            T153: {
                f0: Brand<"T153">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
                f4: string;
                f5: boolean;
                f6: string | null;
                f7: string | null;
            };
            T154: {
                f0: string | null;
                f1: string | null;
                f2: string | null;
                f3: string | null;
                f4: string | null;
                f5: string | null;
                f6: string | null;
            };
            T155: {
                f0: Brand<"T155">;
                f1: Brand<"T142">;
                f2: Brand<"T82">;
                f3: string;
            };
            T156: {
                f0: Brand<"T156">;
                f1: string;
                f2: Brand<"T142">;
                f3: string;
                f4: Brand<"T48"> | null;
                f5: string | null;
                f6: boolean;
                f7: string | null;
                f8: boolean;
                f9: string | null;
                f10: Brand<"T32"> | null;
                f11: Brand<"T142"> | null;
            };
            T157: {
                f0: Brand<"T157">;
                f1: string;
                f2: Brand<"T33"> | null;
                f3: Brand<"T156"> | null;
                f4: Brand<"T142">;
            };
            T158: {
                f0: Brand<"T158">;
                f1: Brand<"T156">;
                f2: boolean;
                f3: string | null;
                f4: string | null;
                f5: string | null;
            };
            T159: {
                f0: Brand<"T142">;
                f1: Brand<"T142"> | null;
                f2: string | null;
            };
            T160: {
                f0: Brand<"T160">;
                f1: string;
                f2: string;
                f3: string;
            };
            T161: {
                f0: Brand<"T161">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
                f4: string;
                f5: boolean;
                f6: string;
            };
            T162: {
                f0: Brand<"T162">;
                f1: Brand<"T142">;
                f2: Brand<"T128">;
                f3: string;
                f4: string;
                f5: Json;
            };
            T163: {
                f0: Brand<"T163">;
                f1: Brand<"T142">;
                f2: number | null;
                f3: number | null;
                f4: number | null;
                f5: string | null;
                f6: Custom<"C68"> | null;
                f7: string | null;
                f8: string | null;
                f9: string | null;
                f10: boolean;
                f11: string | null;
            };
            T164: {
                f0: Custom<"C69">;
                f1: string;
                f2: string;
                f3: string | null;
            };
            T165: {
                f0: Brand<"T165">;
                f1: Brand<"T142">;
                f2: Brand<"T115"> | null;
                f3: Brand<"T22"> | null;
                f4: Brand<"T69"> | null;
                f5: string;
                f6: string;
                f7: Brand<"T82"> | null;
                f8: Brand<"T24"> | null;
            };
            T166: {
                f0: string | null;
                f1: string | null;
                f2: string | null;
                f3: string | null;
                f4: string | null;
            };
            T167: {
                f0: Brand<"T167">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
            };
            T168: {
                f0: Brand<"T142">;
                f1: Brand<"T48">;
                f2: string;
            };
            T169: {
                f0: Brand<"T142">;
                f1: Brand<"T69">;
                f2: string;
            };
            T170: {
                f0: Brand<"T142">;
                f1: Brand<"T115">;
                f2: string;
            };
            T171: {
                f0: Brand<"T171">;
                f1: Brand<"T142">;
                f2: string;
                f3: string;
                f4: string;
                f5: string;
                f6: string | null;
                f7: string | null;
            };
            T172: {
                f0: Brand<"T172">;
                f1: Brand<"T142">;
                f2: string;
                f3: number;
                f4: string;
                f5: string;
                f6: string;
            };
            T173: {
                f0: Brand<"T173">;
                f1: string;
            };
            T174: {
                f0: Brand<"T174">;
                f1: Brand<"T142">;
                f2: Brand<"T173">;
            };
            T175: {
                f0: Brand<"T175">;
                f1: string | null;
                f2: string;
                f3: Brand<"T48">;
                f4: Brand<"T69">;
                f5: Brand<"T115">;
                f6: Brand<"T142">;
                f7: string;
                f8: string;
                f9: Brand<"T142"> | null;
                f10: string | null;
            };
            T176: {
                f0: Brand<"T176">;
                f1: string;
                f2: string;
                f3: string;
                f4: string;
                f5: string;
                f6: string;
                f7: string | null;
                f8: string | null;
                f9: string | null;
                f10: string | null;
                f11: string | null;
                f12: string | null;
                f13: string | null;
            };
        };
    };
    relations: {
        public: {
            Query: {
                T0: { type: "T0"; multiple: true; };
                T1: { type: "T1"; multiple: true; };
                T2: { type: "T2"; multiple: true; };
                T3: { type: "T3"; multiple: true; };
                T4: { type: "T4"; multiple: true; };
                T5: { type: "T5"; multiple: true; };
                T6: { type: "T6"; multiple: true; };
                T7: { type: "T7"; multiple: true; };
                T8: { type: "T8"; multiple: true; };
                T9: { type: "T9"; multiple: true; };
                T10: { type: "T10"; multiple: true; };
                T11: { type: "T11"; multiple: true; };
                T12: { type: "T12"; multiple: true; };
                T13: { type: "T13"; multiple: true; };
                T14: { type: "T14"; multiple: true; };
                T15: { type: "T15"; multiple: true; };
                T16: { type: "T16"; multiple: true; };
                T17: { type: "T17"; multiple: true; };
                T18: { type: "T18"; multiple: true; };
                T19: { type: "T19"; multiple: true; };
                T20: { type: "T20"; multiple: true; };
                T21: { type: "T21"; multiple: true; };
                T22: { type: "T22"; multiple: true; };
                T23: { type: "T23"; multiple: true; };
                T24: { type: "T24"; multiple: true; };
                T25: { type: "T25"; multiple: true; };
                T26: { type: "T26"; multiple: true; };
                T27: { type: "T27"; multiple: true; };
                T28: { type: "T28"; multiple: true; };
                T29: { type: "T29"; multiple: true; };
                T30: { type: "T30"; multiple: true; };
                T31: { type: "T31"; multiple: true; };
                T32: { type: "T32"; multiple: true; };
                T33: { type: "T33"; multiple: true; };
                T34: { type: "T34"; multiple: true; };
                T35: { type: "T35"; multiple: true; };
                T36: { type: "T36"; multiple: true; };
                T37: { type: "T37"; multiple: true; };
                T38: { type: "T38"; multiple: true; };
                T39: { type: "T39"; multiple: true; };
                T40: { type: "T40"; multiple: true; };
                T41: { type: "T41"; multiple: true; };
                T42: { type: "T42"; multiple: true; };
                T43: { type: "T43"; multiple: true; };
                T44: { type: "T44"; multiple: true; };
                T45: { type: "T45"; multiple: true; };
                T46: { type: "T46"; multiple: true; };
                T47: { type: "T47"; multiple: true; };
                T48: { type: "T48"; multiple: true; };
                T49: { type: "T49"; multiple: true; };
                T50: { type: "T50"; multiple: true; };
                T51: { type: "T51"; multiple: true; };
                T52: { type: "T52"; multiple: true; };
                T53: { type: "T53"; multiple: true; };
                T54: { type: "T54"; multiple: true; };
                T55: { type: "T55"; multiple: true; };
                T56: { type: "T56"; multiple: true; };
                T57: { type: "T57"; multiple: true; };
                T58: { type: "T58"; multiple: true; };
                T59: { type: "T59"; multiple: true; };
                T60: { type: "T60"; multiple: true; };
                T61: { type: "T61"; multiple: true; };
                T62: { type: "T62"; multiple: true; };
                T63: { type: "T63"; multiple: true; };
                T64: { type: "T64"; multiple: true; };
                T65: { type: "T65"; multiple: true; };
                T66: { type: "T66"; multiple: true; };
                T67: { type: "T67"; multiple: true; };
                T68: { type: "T68"; multiple: true; };
                T69: { type: "T69"; multiple: true; };
                T70: { type: "T70"; multiple: true; };
                T71: { type: "T71"; multiple: true; };
                T72: { type: "T72"; multiple: true; };
                T73: { type: "T73"; multiple: true; };
                T74: { type: "T74"; multiple: true; };
                T75: { type: "T75"; multiple: true; };
                T76: { type: "T76"; multiple: true; };
                T77: { type: "T77"; multiple: true; };
                T78: { type: "T78"; multiple: true; };
                T79: { type: "T79"; multiple: true; };
                T80: { type: "T80"; multiple: true; };
                T81: { type: "T81"; multiple: true; };
                T82: { type: "T82"; multiple: true; };
                T83: { type: "T83"; multiple: true; };
                T84: { type: "T84"; multiple: true; };
                T85: { type: "T85"; multiple: true; };
                T86: { type: "T86"; multiple: true; };
                T87: { type: "T87"; multiple: true; };
                T88: { type: "T88"; multiple: true; };
                T89: { type: "T89"; multiple: true; };
                T90: { type: "T90"; multiple: true; };
                T91: { type: "T91"; multiple: true; };
                T92: { type: "T92"; multiple: true; };
                T93: { type: "T93"; multiple: true; };
                T94: { type: "T94"; multiple: true; };
                T95: { type: "T95"; multiple: true; };
                T96: { type: "T96"; multiple: true; };
                T97: { type: "T97"; multiple: true; };
                T98: { type: "T98"; multiple: true; };
                T99: { type: "T99"; multiple: true; };
                T100: { type: "T100"; multiple: true; };
                T101: { type: "T101"; multiple: true; };
                T102: { type: "T102"; multiple: true; };
                T103: { type: "T103"; multiple: true; };
                T104: { type: "T104"; multiple: true; };
                T105: { type: "T105"; multiple: true; };
                T106: { type: "T106"; multiple: true; };
                T107: { type: "T107"; multiple: true; };
                T108: { type: "T108"; multiple: true; };
                T109: { type: "T109"; multiple: true; };
                T110: { type: "T110"; multiple: true; };
                T111: { type: "T111"; multiple: true; };
                T112: { type: "T112"; multiple: true; };
                T113: { type: "T113"; multiple: true; };
                T114: { type: "T114"; multiple: true; };
                T115: { type: "T115"; multiple: true; };
                T116: { type: "T116"; multiple: true; };
                T117: { type: "T117"; multiple: true; };
                T118: { type: "T118"; multiple: true; };
                T119: { type: "T119"; multiple: true; };
                T120: { type: "T120"; multiple: true; };
                T121: { type: "T121"; multiple: true; };
                T122: { type: "T122"; multiple: true; };
                T123: { type: "T123"; multiple: true; };
                T124: { type: "T124"; multiple: true; };
                T125: { type: "T125"; multiple: true; };
                T126: { type: "T126"; multiple: true; };
                T127: { type: "T127"; multiple: true; };
                T128: { type: "T128"; multiple: true; };
                T129: { type: "T129"; multiple: true; };
                T130: { type: "T130"; multiple: true; };
                T131: { type: "T131"; multiple: true; };
                T132: { type: "T132"; multiple: true; };
                T133: { type: "T133"; multiple: true; };
                T134: { type: "T134"; multiple: true; };
                T135: { type: "T135"; multiple: true; };
                T136: { type: "T136"; multiple: true; };
                T137: { type: "T137"; multiple: true; };
                T138: { type: "T138"; multiple: true; };
                T139: { type: "T139"; multiple: true; };
                T140: { type: "T140"; multiple: true; };
                T141: { type: "T141"; multiple: true; };
                T142: { type: "T142"; multiple: true; };
                T143: { type: "T143"; multiple: true; };
                T144: { type: "T144"; multiple: true; };
                T145: { type: "T145"; multiple: true; };
                T146: { type: "T146"; multiple: true; };
                T147: { type: "T147"; multiple: true; };
                T148: { type: "T148"; multiple: true; };
                T149: { type: "T149"; multiple: true; };
                T150: { type: "T150"; multiple: true; };
                T151: { type: "T151"; multiple: true; };
                T152: { type: "T152"; multiple: true; };
                T153: { type: "T153"; multiple: true; };
                T154: { type: "T154"; multiple: true; };
                T155: { type: "T155"; multiple: true; };
                T156: { type: "T156"; multiple: true; };
                T157: { type: "T157"; multiple: true; };
                T158: { type: "T158"; multiple: true; };
                T159: { type: "T159"; multiple: true; };
                T160: { type: "T160"; multiple: true; };
                T161: { type: "T161"; multiple: true; };
                T162: { type: "T162"; multiple: true; };
                T163: { type: "T163"; multiple: true; };
                T164: { type: "T164"; multiple: true; };
                T165: { type: "T165"; multiple: true; };
                T166: { type: "T166"; multiple: true; };
                T167: { type: "T167"; multiple: true; };
                T168: { type: "T168"; multiple: true; };
                T169: { type: "T169"; multiple: true; };
                T170: { type: "T170"; multiple: true; };
                T171: { type: "T171"; multiple: true; };
                T172: { type: "T172"; multiple: true; };
                T173: { type: "T173"; multiple: true; };
                T174: { type: "T174"; multiple: true; };
                T175: { type: "T175"; multiple: true; };
                T176: { type: "T176"; multiple: true; };
            };
            T0: {
                r0: { type: "T142"; nullable: true; };
            };
            T1: {
                r0: { type: "T142"; };
            };
            T3: {
                r0: { type: "T147"; multiple: true; };
            };
            T4: {
                r0: { type: "T5"; multiple: true; };
            };
            T5: {
                r0: { type: "T6"; multiple: true; };
            };
            T6: {
                r0: { type: "T8"; };
                r1: { type: "T5"; };
            };
            T8: {
                r0: { type: "T9"; multiple: true; };
            };
            T11: {
                r0: { type: "T12"; multiple: true; };
            };
            T14: {
                r0: { type: "T15"; multiple: true; };
                r1: { type: "T18"; multiple: true; };
            };
            T15: {
                r0: { type: "T14"; };
            };
            T18: {
                r0: { type: "T14"; };
            };
            T19: {
                r0: { type: "T20"; multiple: true; };
            };
            T22: {
                r0: { type: "T83"; multiple: true; };
            };
            T24: {
                r0: { type: "T87"; multiple: true; };
            };
            T26: {
                r0: { type: "T27"; };
            };
            T28: {
                r0: { type: "T44"; nullable: true; };
                r1: { type: "T48"; nullable: true; };
                r2: { type: "T69"; nullable: true; };
                r3: { type: "T32"; multiple: true; };
                r4: { type: "T41"; multiple: true; };
            };
            T29: {
                r0: { type: "T22"; nullable: true; };
                r1: { type: "T28"; };
                r2: { type: "T32"; };
                r3: { type: "T135"; nullable: true; };
            };
            T30: {
                r0: { type: "T28"; };
                r1: { type: "T48"; };
                r2: { type: "T32"; };
                r3: { type: "T135"; nullable: true; };
                r4: { type: "T142"; };
            };
            T31: {
                r0: { type: "T28"; };
                r1: { type: "T135"; nullable: true; };
            };
            T32: {
                r0: { type: "T28"; };
                r1: { type: "T48"; nullable: true; };
                r2: { type: "T69"; nullable: true; };
                r3: { type: "T82"; nullable: true; };
                r4: { type: "T115"; nullable: true; };
                r5: { type: "T32"; nullable: true; };
                r6: { type: "T135"; nullable: true; };
                r7: { type: "T142"; };
                r8: { type: "T29"; multiple: true; };
                r9: { type: "T31"; multiple: true; };
                r10: { type: "T39"; multiple: true; };
                r11: { type: "T33"; multiple: true; };
                r12: { type: "T40"; multiple: true; };
                r13: { type: "T32"; multiple: true; };
                r14: { type: "T42"; multiple: true; };
            };
            T33: {
                r0: { type: "T32"; };
                r1: { type: "T142"; };
                r2: { type: "T34"; multiple: true; };
                r3: { type: "T35"; multiple: true; };
                r4: { type: "T36"; multiple: true; };
                r5: { type: "T38"; multiple: true; };
            };
            T34: {
                r0: { type: "T32"; };
                r1: { type: "T33"; };
            };
            T35: {
                r0: { type: "T32"; };
                r1: { type: "T33"; };
            };
            T36: {
                r0: { type: "T32"; };
                r1: { type: "T33"; };
            };
            T37: {
                r0: { type: "T32"; };
                r1: { type: "T33"; };
            };
            T38: {
                r0: { type: "T32"; };
                r1: { type: "T33"; };
            };
            T39: {
                r0: { type: "T24"; };
                r1: { type: "T28"; };
                r2: { type: "T32"; };
                r3: { type: "T135"; nullable: true; };
                r4: { type: "T142"; };
            };
            T40: {
                r0: { type: "T28"; };
            };
            T41: {
                r0: { type: "T28"; };
                r1: { type: "T135"; nullable: true; };
                r2: { type: "T142"; };
            };
            T42: {
                r0: { type: "T28"; };
                r1: { type: "T135"; nullable: true; };
            };
            T44: {
                r0: { type: "T28"; multiple: true; };
                r1: { type: "T46"; multiple: true; };
            };
            T45: {
                r0: { type: "T44"; };
                r1: { type: "T69"; };
            };
            T46: {
                r0: { type: "T44"; };
                r1: { type: "T142"; };
            };
            T47: {
                r0: { type: "T142"; };
                r1: { type: "T142"; };
            };
            T48: {
                r0: { type: "T142"; nullable: true; };
                r1: { type: "T142"; nullable: true; };
                r2: { type: "T161"; nullable: true; };
                r3: { type: "T32"; multiple: true; };
                r4: { type: "T28"; multiple: true; };
                r5: { type: "T51"; multiple: true; };
                r6: { type: "T62"; multiple: true; };
                r7: { type: "T69"; multiple: true; };
                r8: { type: "T53"; multiple: true; };
                r9: { type: "T175"; multiple: true; };
                r10: { type: "T49"; multiple: true; };
                r11: { type: "T52"; multiple: true; };
            };
            T49: {
                r0: { type: "T48"; };
                r1: { type: "T151"; };
            };
            T50: {
                r0: { type: "T48"; };
            };
            T51: {
                r0: { type: "T48"; };
            };
            T52: {
                r0: { type: "T48"; };
                r1: { type: "T171"; };
            };
            T53: {
                r0: { type: "T48"; };
                r1: { type: "T142"; nullable: true; };
                r2: { type: "T142"; nullable: true; };
                r3: { type: "T69"; nullable: true; };
            };
            T54: {
                r0: { type: "T142"; };
            };
            T55: {
                r0: { type: "T48"; };
                r1: { type: "T142"; };
            };
            T56: {
                r0: { type: "T142"; nullable: true; };
            };
            T57: {
                r0: { type: "T142"; nullable: true; };
            };
            T58: {
                r0: { type: "T116"; multiple: true; };
            };
            T61: {
                r0: { type: "T70"; multiple: true; };
            };
            T62: {
                r0: { type: "T48"; nullable: true; };
                r1: { type: "T142"; nullable: true; };
                r2: { type: "T142"; nullable: true; };
                r3: { type: "T142"; multiple: true; };
            };
            T63: {
                r0: { type: "T142"; nullable: true; };
                r1: { type: "T115"; nullable: true; };
                r2: { type: "T135"; nullable: true; };
                r3: { type: "T67"; multiple: true; };
            };
            T64: {
                r0: { type: "T71"; multiple: true; };
            };
            T67: {
                r0: { type: "T63"; nullable: true; };
                r1: { type: "T115"; nullable: true; };
                r2: { type: "T142"; nullable: true; };
                r3: { type: "T142"; nullable: true; };
            };
            T69: {
                r0: { type: "T48"; nullable: true; };
                r1: { type: "T142"; nullable: true; };
                r2: { type: "T142"; };
                r3: { type: "T80"; nullable: true; };
                r4: { type: "T81"; nullable: true; };
                r5: { type: "T142"; nullable: true; };
                r6: { type: "T135"; nullable: true; };
                r7: { type: "T53"; multiple: true; };
                r8: { type: "T70"; multiple: true; };
                r9: { type: "T79"; multiple: true; };
                r10: { type: "T71"; multiple: true; };
                r11: { type: "T72"; multiple: true; };
                r12: { type: "T114"; multiple: true; };
                r13: { type: "T115"; multiple: true; };
                r14: { type: "T169"; multiple: true; };
                r15: { type: "T73"; multiple: true; };
                r16: { type: "T74"; multiple: true; };
                r17: { type: "T75"; multiple: true; };
                r18: { type: "T175"; multiple: true; };
            };
            T70: {
                r0: { type: "T61"; };
                r1: { type: "T69"; };
            };
            T71: {
                r0: { type: "T64"; };
                r1: { type: "T69"; };
            };
            T72: {
                r0: { type: "T69"; };
                r1: { type: "T113"; };
            };
            T73: {
                r0: { type: "T69"; };
                r1: { type: "T132"; };
            };
            T74: {
                r0: { type: "T69"; };
                r1: { type: "T142"; };
            };
            T75: {
                r0: { type: "T69"; };
                r1: { type: "T134"; };
            };
            T76: {
                r0: { type: "T142"; nullable: true; };
                r1: { type: "T142"; nullable: true; };
                r2: { type: "T69"; };
            };
            T77: {
                r0: { type: "T142"; };
            };
            T79: {
                r0: { type: "T69"; };
                r1: { type: "T78"; };
            };
            T81: {
                r0: { type: "T69"; };
            };
            T82: {
                r0: { type: "T142"; };
                r1: { type: "T164"; nullable: true; };
                r2: { type: "T135"; nullable: true; };
                r3: { type: "T83"; multiple: true; };
                r4: { type: "T155"; multiple: true; };
                r5: { type: "T85"; multiple: true; };
                r6: { type: "T87"; multiple: true; };
                r7: { type: "T84"; multiple: true; };
                r8: { type: "T88"; multiple: true; };
            };
            T83: {
                r0: { type: "T22"; };
                r1: { type: "T82"; };
            };
            T84: {
                r0: { type: "T82"; };
            };
            T85: {
                r0: { type: "T82"; };
                r1: { type: "T86"; multiple: true; };
            };
            T86: {
                r0: { type: "T87"; };
                r1: { type: "T85"; };
            };
            T87: {
                r0: { type: "T24"; };
                r1: { type: "T82"; };
                r2: { type: "T142"; };
                r3: { type: "T86"; multiple: true; };
            };
            T88: {
                r0: { type: "T82"; };
            };
            T90: {
                r0: { type: "T67"; nullable: true; };
                r1: { type: "T89"; };
                r2: { type: "T91"; multiple: true; };
            };
            T91: {
                r0: { type: "T67"; nullable: true; };
                r1: { type: "T90"; };
                r2: { type: "T89"; };
            };
            T92: {
                r0: { type: "T67"; nullable: true; };
                r1: { type: "T89"; };
                r2: { type: "T145"; multiple: true; };
                r3: { type: "T95"; multiple: true; };
                r4: { type: "T98"; multiple: true; };
                r5: { type: "T99"; multiple: true; };
                r6: { type: "T101"; multiple: true; };
                r7: { type: "T103"; multiple: true; };
            };
            T93: {
                r0: { type: "T92"; };
            };
            T94: {
                r0: { type: "T93"; };
                r1: { type: "T92"; };
            };
            T101: {
                r0: { type: "T102"; multiple: true; };
            };
            T105: {
                r0: { type: "T106"; nullable: true; };
                r1: { type: "T107"; multiple: true; };
            };
            T106: {
                r0: { type: "T105"; multiple: true; };
            };
            T108: {
                r0: { type: "T109"; };
            };
            T109: {
                r0: { type: "T110"; };
            };
            T113: {
                r0: { type: "T72"; multiple: true; };
            };
            T114: {
                r0: { type: "T142"; };
                r1: { type: "T69"; };
            };
            T115: {
                r0: { type: "T24"; nullable: true; };
                r1: { type: "T69"; };
                r2: { type: "T50"; multiple: true; };
                r3: { type: "T116"; multiple: true; };
                r4: { type: "T117"; multiple: true; };
                r5: { type: "T170"; multiple: true; };
                r6: { type: "T118"; multiple: true; };
                r7: { type: "T119"; multiple: true; };
                r8: { type: "T175"; multiple: true; };
            };
            T116: {
                r0: { type: "T58"; };
                r1: { type: "T115"; };
            };
            T117: {
                r0: { type: "T115"; };
                r1: { type: "T121"; };
            };
            T118: {
                r0: { type: "T115"; };
            };
            T119: {
                r0: { type: "T115"; };
                r1: { type: "T134"; };
            };
            T120: {
                r0: { type: "T142"; };
            };
            T121: {
                r0: { type: "T117"; multiple: true; };
            };
            T122: {
                r0: { type: "T142"; nullable: true; };
            };
            T123: {
                r0: { type: "T124"; multiple: true; };
            };
            T124: {
                r0: { type: "T27"; };
                r1: { type: "T123"; };
            };
            T128: {
                r0: { type: "T135"; nullable: true; };
                r1: { type: "T142"; nullable: true; };
                r2: { type: "T145"; multiple: true; };
                r3: { type: "T129"; multiple: true; };
            };
            T131: {
                r0: { type: "T142"; nullable: true; };
            };
            T132: {
                r0: { type: "T73"; multiple: true; };
            };
            T133: {
                r0: { type: "T142"; };
                r1: { type: "T142"; };
            };
            T134: {
                r0: { type: "T75"; multiple: true; };
                r1: { type: "T119"; multiple: true; };
            };
            T135: {
                r0: { type: "T136"; multiple: true; };
                r1: { type: "T140"; multiple: true; };
            };
            T136: {
                r0: { type: "T135"; };
                r1: { type: "T140"; nullable: true; };
                r2: { type: "T142"; };
            };
            T137: {
                r0: { type: "T142"; };
                r1: { type: "T135"; };
            };
            T138: {
                r0: { type: "T135"; };
            };
            T139: {
                r0: { type: "T135"; };
            };
            T140: {
                r0: { type: "T135"; };
            };
            T141: {
                r0: { type: "T135"; };
            };
            T142: {
                r0: { type: "T163"; nullable: true; };
                r1: { type: "T33"; multiple: true; };
                r2: { type: "T32"; multiple: true; };
                r3: { type: "T149"; multiple: true; };
                r4: { type: "T48"; multiple: true; };
                r5: { type: "T48"; multiple: true; };
                r6: { type: "T151"; multiple: true; };
                r7: { type: "T69"; multiple: true; };
                r8: { type: "T159"; multiple: true; };
                r9: { type: "T41"; multiple: true; };
                r10: { type: "T175"; multiple: true; };
                r11: { type: "T175"; multiple: true; };
                r12: { type: "T153"; multiple: true; };
                r13: { type: "T126"; multiple: true; };
                r14: { type: "T167"; multiple: true; };
                r15: { type: "T169"; multiple: true; };
                r16: { type: "T170"; multiple: true; };
                r17: { type: "T133"; multiple: true; };
                r18: { type: "T171"; multiple: true; };
                r19: { type: "T137"; multiple: true; };
                r20: { type: "T136"; multiple: true; };
                r21: { type: "T46"; multiple: true; };
                r22: { type: "T174"; multiple: true; };
            };
            T143: {
                r0: { type: "T142"; };
            };
            T145: {
                r0: { type: "T92"; nullable: true; };
                r1: { type: "T128"; nullable: true; };
                r2: { type: "T135"; nullable: true; };
                r3: { type: "T142"; nullable: true; };
            };
            T146: {
                r0: { type: "T93"; nullable: true; };
                r1: { type: "T95"; nullable: true; };
                r2: { type: "T99"; nullable: true; };
                r3: { type: "T145"; };
                r4: { type: "T101"; nullable: true; };
            };
            T148: {
                r0: { type: "T142"; };
            };
            T149: {
                r0: { type: "T142"; };
            };
            T150: {
                r0: { type: "T142"; };
            };
            T151: {
                r0: { type: "T142"; };
            };
            T154: {
                r0: { type: "T22"; nullable: true; };
                r1: { type: "T24"; nullable: true; };
                r2: { type: "T48"; nullable: true; };
                r3: { type: "T69"; nullable: true; };
                r4: { type: "T115"; nullable: true; };
                r5: { type: "T142"; nullable: true; };
            };
            T155: {
                r0: { type: "T82"; };
                r1: { type: "T142"; };
            };
            T156: {
                r0: { type: "T48"; nullable: true; };
                r1: { type: "T142"; nullable: true; };
                r2: { type: "T32"; nullable: true; };
                r3: { type: "T142"; };
            };
            T157: {
                r0: { type: "T33"; nullable: true; };
                r1: { type: "T142"; };
                r2: { type: "T156"; nullable: true; };
            };
            T158: {
                r0: { type: "T156"; };
            };
            T159: {
                r0: { type: "T142"; };
            };
            T161: {
                r0: { type: "T142"; };
            };
            T162: {
                r0: { type: "T128"; };
                r1: { type: "T142"; };
            };
            T165: {
                r0: { type: "T22"; nullable: true; };
                r1: { type: "T24"; nullable: true; };
                r2: { type: "T69"; nullable: true; };
                r3: { type: "T115"; nullable: true; };
                r4: { type: "T142"; };
            };
            T166: {
                r0: { type: "T48"; nullable: true; };
                r1: { type: "T69"; nullable: true; };
                r2: { type: "T82"; nullable: true; };
            };
            T167: {
                r0: { type: "T142"; };
            };
            T168: {
                r0: { type: "T48"; };
                r1: { type: "T142"; };
            };
            T169: {
                r0: { type: "T69"; };
                r1: { type: "T142"; };
            };
            T170: {
                r0: { type: "T115"; };
                r1: { type: "T142"; };
            };
            T171: {
                r0: { type: "T142"; };
            };
            T172: {
                r0: { type: "T142"; };
            };
            T174: {
                r0: { type: "T173"; };
                r1: { type: "T142"; };
            };
            T175: {
                r0: { type: "T48"; };
                r1: { type: "T142"; };
                r2: { type: "T142"; nullable: true; };
                r3: { type: "T69"; };
                r4: { type: "T115"; };
            };
        };
    };
    rootTypes: {
        query: "Query";
    };
};

export type AnonymizedRealSchemaStats = {
    tables: 177;
    fields: 1479;
    relationTables: 128;
    customFields: 70;
};
