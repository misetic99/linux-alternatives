#!/usr/bin/env node
// Validate every file in data/ against the JSON Schemas and cross-file rules.
import path from "node:path";
import { REPO_ROOT, validateData } from "./lib.mjs";

const dataDir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(REPO_ROOT, "data");
const errors = validateData(dataDir);

if (errors.length) {
  console.error(`\n✖ ${errors.length} problem(s) found:\n`);
  for (const e of errors) console.error(`  - ${e}`);
  console.error("");
  process.exit(1);
}
console.log("✔ All data files are valid.");
