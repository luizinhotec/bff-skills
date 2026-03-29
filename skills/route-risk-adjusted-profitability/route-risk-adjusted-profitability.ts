#!/usr/bin/env bun
import { execFileSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2] ?? "";
try {
  const result = execFileSync("node", [join(__dirname, "index.cjs"), input], { encoding: "utf8" });
  process.stdout.write(result);
} catch (e: any) {
  process.stdout.write(e.stdout ?? JSON.stringify({ ok: false, error: "EXECUTION_ERROR" }));
  process.exit(1);
}
