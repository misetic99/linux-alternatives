#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, loadData, validateData } from "./lib.mjs";
import { collectLinks, checkLinks, reportMarkdown } from "./links.mjs";

const args = process.argv.slice(2);
const options = { output: path.join(REPO_ROOT, "dist", "reports", "link-checks.json"), concurrency: 6, timeoutMs: 8000, retries: 1, strict: false };
try {
  for (let i = 0; i < args.length; i += 1) {
    const name = args[i];
    if (name === "--strict") options.strict = true;
    else if (name === "--output" && args[i + 1]) options.output = path.resolve(args[++i]);
    else if (["--concurrency", "--timeout", "--retries"].includes(name)) {
      const value = Number(args[++i]);
      const bounds = name === "--concurrency" ? [1, 12] : name === "--timeout" ? [100, 30000] : [0, 2];
      if (!Number.isInteger(value) || value < bounds[0] || value > bounds[1]) throw new Error(`Invalid ${name}. Expected ${bounds[0]}–${bounds[1]}.`);
      options[name === "--timeout" ? "timeoutMs" : name.slice(2)] = value;
    } else throw new Error(`Unknown or incomplete argument: ${name}`);
  }
  if (!options.output.endsWith(".json")) throw new Error("The report output must end in .json.");
  const dataDir = path.join(REPO_ROOT, "data");
  const errors = validateData(dataDir);
  if (errors.length) throw new Error(`Invalid data. Run npm run validate.\n${errors.join("\n")}`);
  const inventory = collectLinks(loadData(dataDir).entries);
  console.log(`Checking ${inventory.length} unique URLs; at most one active URL per origin.`);
  const report = await checkLinks(inventory, {
    concurrency: options.concurrency, timeoutMs: options.timeoutMs, retries: options.retries,
    onProgress: (result, completed, total) => {
      if (completed % 25 === 0 || completed === total) console.log(`${completed}/${total}: ${result.state}`);
    },
  });
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(options.output.replace(/\.json$/, ".md"), reportMarkdown(report));
  console.log(JSON.stringify(report.counts));
  console.log(`Reports written to ${path.relative(REPO_ROOT, options.output)} and the matching .md file.`);
  if (options.strict && report.counts.broken + report.counts.invalid > 0) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
