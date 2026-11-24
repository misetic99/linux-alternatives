#!/usr/bin/env node
// Tiny static file server for previewing dist/ locally: `npm run dev`.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { REPO_ROOT } from "./lib.mjs";

const root = path.join(REPO_ROOT, "dist");
const port = Number(process.env.PORT) || 4173;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

if (!fs.existsSync(root)) {
  console.error('✖ dist/ not found. Run "npm run build" first.');
  process.exit(1);
}

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = path.join(root, urlPath.endsWith("/") ? urlPath + "index.html" : urlPath);
    // Never serve anything outside dist/.
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403).end("Forbidden");
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404).end("Not found");
        return;
      }
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`Preview: http://localhost:${port}/`));
