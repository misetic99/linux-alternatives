#!/usr/bin/env node
// Maintainer helper: turn the body of a "Compatibility report" issue into a draft
// report file. Offline; writes only dist/review/report-draft.yaml, never data/.
//
//   npm run report:draft -- issue.md --reporter some-handle [--date 2026-11-25]
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, loadData, validateData } from "./lib.mjs";
import { draftReport } from "./report-issue.mjs";

try {
  const args = process.argv.slice(2);
  let input = null;
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--reporter" || arg === "--date") {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      if (options[arg.slice(2)] !== undefined) throw new Error(`Repeated argument: ${arg}`);
      options[arg.slice(2)] = value;
      i += 1;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown argument: ${arg}`);
    } else if (input === null) {
      input = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (!input) throw new Error("Usage: npm run report:draft -- <issue-body-file | -> --reporter <github-handle> [--date YYYY-MM-DD]");

  const body = input === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(path.resolve(input), "utf8");
  if (body.length > 100_000) throw new Error("The issue text is unexpectedly large (over 100 KB).");

  const dataDir = path.join(REPO_ROOT, "data");
  const problems = validateData(dataDir);
  if (problems.length) throw new Error(`The catalog is invalid. Run npm run validate.\n${problems.join("\n")}`);
  const apps = loadData(dataDir).entries.filter((e) => e.kind === "app").map((e) => e.data);

  const result = draftReport(body, apps, options);
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(`error: ${error}`);
    process.exitCode = 1;
  } else {
    const out = path.join(REPO_ROOT, "dist", "review", "report-draft.yaml");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, result.yaml);
    console.log(result.yaml);
    console.log(`Draft written to ${path.relative(REPO_ROOT, out)}. Suggested path: ${result.path}`);
    console.log("Review it, then copy it into data/reports/ yourself and run npm run check.");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
