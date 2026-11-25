#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, loadData, validateData } from "./lib.mjs";
import { buildReviewTasks, reviewMarkdown } from "./review.mjs";

try {
  const args = process.argv.slice(2);
  const options = {};
  const categories = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "schema", "app.schema.json"), "utf8")).$defs.category.enum;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!["--app", "--category", "--limit"].includes(flag) || !args[index + 1] || args[index + 1].startsWith("--")) throw new Error(`Unknown or incomplete argument: ${flag}`);
    const key = flag.slice(2);
    if (options[key] !== undefined) throw new Error(`Repeated argument: ${flag}`);
    const value = args[++index];
    if (key === "limit") {
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error("--limit must be a positive integer.");
      options.limit = Number(value);
    } else if (key === "category") {
      if (!categories.includes(value)) throw new Error(`Unknown category: ${value}. Use one of: ${categories.join(", ")}.`);
      options.category = value;
    } else {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(value)) throw new Error("--app must be an app id, such as autocad.");
      options.app = value;
    }
  }
  const dataDir = path.join(REPO_ROOT, "data");
  const errors = validateData(dataDir);
  if (errors.length) throw new Error(`Invalid data. Run npm run validate.\n${errors.join("\n")}`);
  const backlog = buildReviewTasks(loadData(dataDir).entries, options);
  const output = path.join(REPO_ROOT, "dist", "review");
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, "verification.json"), JSON.stringify(backlog, null, 2) + "\n");
  fs.writeFileSync(path.join(output, "verification.md"), reviewMarkdown(backlog));
  console.log(`Wrote ${backlog.selected_total} verification draft(s) from ${backlog.matching_total} matching unverified entries.`);
  console.log("Reports: dist/review/verification.json and dist/review/verification.md. No issues opened; catalog unchanged.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
