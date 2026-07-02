// scripts/dist-smoke.mjs
//
// Post-build smoke test of the published artifact. Imports from ./dist exactly
// as a consumer would (through package.json "exports"/"main") and asserts the
// public runtime surface is intact, plus that the type-declaration entry exists
// and is non-empty. Catches build-output regressions — a broken exports map,
// a dropped export, or missing .d.ts — that the src-based test suite cannot.
//
// Run AFTER `npm run build` (see the "test:dist" / "prepublishOnly" scripts).
// Kept as a plain .mjs (not a *.test.ts) so the default `bun test` run, which
// does not build, never tries to import an unbuilt dist/.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const failures = [];
const fail = (msg) => failures.push(msg);

// 1. The package resolves and exposes the documented runtime exports.
let api;
try {
    api = await import(resolve(root, "dist/index.js"));
}
catch (err) {
    console.error(
        "FAIL: could not import dist/index.js — did you run `npm run build`?",
    );
    console.error(err);
    process.exit(1);
}

if (typeof api.version !== "string") {
    fail(`missing or non-string export: version (got ${typeof api.version})`);
}

// 2. The type-declaration entry point exists and is non-empty (consumers rely
//    on package.json "types").
const dts = resolve(root, "dist/index.d.ts");
if (!existsSync(dts)) {
    fail("dist/index.d.ts is missing");
}
else if (readFileSync(dts, "utf8").trim().length === 0) {
    fail("dist/index.d.ts is empty");
}

// 3. Subpath entries (runtime + hasura) resolve and expose their runtime
//    surface, and their .d.ts entries exist.
for (
    const [ subpath, expected ] of [
        [ "runtime", [
            "extractResult",
            "buildOperationDocument",
            "buildFieldArguments",
        ] ],
        [ "hasura", [
            "createHasuraClient",
            "HasuraTableBuilder",
            "generateAggregateSelection",
            "buildListRequest",
            "buildInsertRequest",
            "buildUpdateRequest",
            "buildDeleteRequest",
            "buildAggregateRequest",
        ] ],
    ]
) {
    let sub;
    try {
        sub = await import(resolve(root, `dist/${subpath}/index.js`));
    }
    catch {
        fail(`could not import dist/${subpath}/index.js`);
        continue;
    }
    for (const name of expected) {
        if (typeof sub[name] !== "function") {
            fail(`dist/${subpath} missing function export: ${name}`);
        }
    }
    const subDts = resolve(root, `dist/${subpath}/index.d.ts`);
    if (!existsSync(subDts)) {
        fail(`dist/${subpath}/index.d.ts is missing`);
    }
}

if (failures.length > 0) {
    console.error(`dist smoke test FAILED (${failures.length}):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
}

console.log("dist smoke test passed: root + runtime + hasura entries OK");
