#!/usr/bin/env node
// Build dist/ (JSON API) from data/. dist/ is generated and never committed.
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, buildDist } from "./lib.mjs";

const dataDir = path.join(REPO_ROOT, "data");
const outDir = path.join(REPO_ROOT, "dist", "api", "v1");

let result;
try {
  result = buildDist(dataDir);
} catch (e) {
  console.error(`✖ ${e.message}`);
  for (const msg of e.validationErrors ?? []) console.error(`  - ${msg}`);
  process.exit(1);
}

fs.rmSync(path.join(REPO_ROOT, "dist"), { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "apps"), { recursive: true });

const write = (file, value) =>
  fs.writeFileSync(path.join(outDir, file), JSON.stringify(value, null, 2) + "\n");

write("index.json", result.index);
write("apps.json", result.apps);
write("alternatives.json", result.alternatives);
for (const app of result.apps) write(`apps/${app.id}.json`, app);

console.log(
  `✔ Built ${result.apps.length} app(s), ${result.alternatives.length} alternative(s) → dist/api/v1/`
);
