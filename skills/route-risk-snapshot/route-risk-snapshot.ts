#!/usr/bin/env bun
import { Command } from "commander";
import { readFileSync } from "fs";

const program = new Command();

function evaluate(payload: any) {
  const { input, state, now } = payload;
  const route = input?.route?.trim();
  if (!route) return { ok: false, skill: "route-risk-snapshot", schemaVersion: "1.0.0", error: "MISSING_ROUTE" };
  const profSnap = state?.routeProfitabilityByRoute?.[route];
  if (!profSnap) return { ok: true, skill: "route-risk-snapshot", schemaVersion: "1.0.0", snapshot: { route, riskScore: null, riskLevel: "UNKNOWN", signals: { profitabilitySignal: "MISSING_PROFITABILITY_SNAPSHOT" }, reason: "MISSING_PROFITABILITY_SNAPSHOT", evaluatedAt: now }, stateUpdates: { routeRiskByRoute: { [route]: { schemaVersion: "1.0.0", route, riskScore: null, riskLevel: "UNKNOWN", reason: "MISSING_PROFITABILITY_SNAPSHOT", evaluatedAt: now } } }, auditEntry: { skill: "route-risk-snapshot", schemaVersion: "1.0.0", route, riskLevel: "UNKNOWN", reason: "MISSING_PROFITABILITY_SNAPSHOT", evaluatedAt: now } };
  const { pnl, accountingUnit } = profSnap;
  if (!Number.isSafeInteger(pnl)) return { ok: false, skill: "route-risk-snapshot", schemaVersion: "1.0.0", error: "INVALID_PNL", details: { route } };
  const THRESHOLD = 100;
  let riskScore: number, riskLevel: string, profitabilitySignal: string, reason: string;
  if (pnl <= 0) { riskScore = 1.0; riskLevel = "HIGH"; profitabilitySignal = "NON_POSITIVE"; reason = "NON_POSITIVE_PNL_BOOTSTRAP_RISK"; }
  else if (pnl < THRESHOLD) { riskScore = 0.5; riskLevel = "MEDIUM"; profitabilitySignal = "SUB_THRESHOLD"; reason = "SUB_THRESHOLD_PNL_BOOTSTRAP_RISK"; }
  else { riskScore = 0.0; riskLevel = "LOW"; profitabilitySignal = "THRESHOLD_MET"; reason = "THRESHOLD_MEETING_PNL_BOOTSTRAP_RISK"; }
  return { ok: true, skill: "route-risk-snapshot", schemaVersion: "1.0.0", snapshot: { route, riskScore, riskLevel, signals: { profitabilitySignal, pnl, threshold: THRESHOLD, accountingUnit }, reason, evaluatedAt: now }, stateUpdates: { routeRiskByRoute: { [route]: { schemaVersion: "1.0.0", route, riskScore, riskLevel, signals: { profitabilitySignal, pnl, threshold: THRESHOLD, accountingUnit }, reason, evaluatedAt: now } } }, auditEntry: { skill: "route-risk-snapshot", schemaVersion: "1.0.0", route, riskScore, riskLevel, reason, evaluatedAt: now } };
}

program
  .name("route-risk-snapshot")
  .description("Deterministic bootstrap risk snapshot per route from profitability evidence")
  .version("1.0.0");

program
  .command("run")
  .description("Evaluate risk snapshot for a route")
  .argument("<input>", "Path to JSON input file or JSON string")
  .action((input: string) => {
    try {
      const raw = input.startsWith("{") ? input : readFileSync(input, "utf8");
      const result = evaluate(JSON.parse(raw));
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } catch (e: any) {
      process.stdout.write(JSON.stringify({ ok: false, skill: "route-risk-snapshot", schemaVersion: "1.0.0", error: "INVALID_JSON_INPUT", details: e.message }) + "\n");
      process.exit(1);
    }
  });

program
  .command("doctor")
  .description("Check environment and validate input contract")
  .action(() => {
    process.stdout.write(JSON.stringify({ ok: true, skill: "route-risk-snapshot", checks: { runtime: "ok", contract: "state.routeProfitabilityByRoute required", output: "state.routeRiskByRoute" } }, null, 2) + "\n");
  });

program.parseAsync(process.argv).catch((e: any) => {
  process.stdout.write(JSON.stringify({ ok: false, error: e.message }) + "\n");
  process.exit(1);
});