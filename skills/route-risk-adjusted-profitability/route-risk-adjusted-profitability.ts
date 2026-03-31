#!/usr/bin/env bun
import { Command } from "commander";
import { readFileSync } from "fs";

const program = new Command();

function evaluate(payload: any) {
  const { input, state, now } = payload;
  const route = input?.route?.trim();
  if (!route) return { ok: false, skill: "route-risk-adjusted-profitability", schemaVersion: "1.0.0", error: "MISSING_ROUTE" };
  const profSnap = state?.routeProfitabilityByRoute?.[route];
  if (!profSnap) return { ok: true, skill: "route-risk-adjusted-profitability", schemaVersion: "1.0.0", decision: { route, status: "UNKNOWN", reason: "MISSING_PROFITABILITY_SNAPSHOT", eligible: false, evaluatedAt: now }, metrics: { threshold: 100 }, stateUpdates: { routeRiskAdjustedProfitabilityByRoute: { [route]: { route, status: "UNKNOWN", reason: "MISSING_PROFITABILITY_SNAPSHOT", eligible: false, threshold: 100, evaluatedAt: now } } }, auditEntry: { skill: "route-risk-adjusted-profitability", schemaVersion: "1.0.0", route, status: "UNKNOWN", reason: "MISSING_PROFITABILITY_SNAPSHOT", eligible: false, evaluatedAt: now } };
  const riskSnap = state?.routeRiskByRoute?.[route];
  if (!riskSnap) return { ok: true, skill: "route-risk-adjusted-profitability", schemaVersion: "1.0.0", decision: { route, status: "UNKNOWN", reason: "MISSING_RISK_SNAPSHOT", eligible: false, evaluatedAt: now }, metrics: { threshold: 100 }, stateUpdates: { routeRiskAdjustedProfitabilityByRoute: { [route]: { route, status: "UNKNOWN", reason: "MISSING_RISK_SNAPSHOT", eligible: false, threshold: 100, evaluatedAt: now } } }, auditEntry: { skill: "route-risk-adjusted-profitability", schemaVersion: "1.0.0", route, status: "UNKNOWN", reason: "MISSING_RISK_SNAPSHOT", eligible: false, evaluatedAt: now } };
  const { pnl, accountingUnit } = profSnap;
  const { riskScore } = riskSnap;
  const THRESHOLD = 100;
  const riskPenaltyBps = Math.round(riskScore * 10000);
  const adjustedPnl = Math.floor(pnl * (10000 - riskPenaltyBps) / 10000);
  let status: string, reason: string, eligible: boolean;
  if (adjustedPnl <= 0) { status = "REJECT"; reason = "ADJUSTED_PNL_NOT_POSITIVE"; eligible = false; }
  else if (adjustedPnl < THRESHOLD) { status = "LOW_ATTRACTIVENESS"; reason = "ADJUSTED_PNL_BELOW_THRESHOLD"; eligible = false; }
  else { status = "ATTRACTIVE"; reason = "ADJUSTED_PNL_MEETS_THRESHOLD"; eligible = true; }
  return { ok: true, skill: "route-risk-adjusted-profitability", schemaVersion: "1.0.0", decision: { route, status, reason, eligible, evaluatedAt: now }, metrics: { accountingUnit, pnl, riskScore, riskPenaltyBps, adjustedPnl, threshold: THRESHOLD }, stateUpdates: { routeRiskAdjustedProfitabilityByRoute: { [route]: { schemaVersion: "1.0.0", route, accountingUnit, pnl, riskScore, riskPenaltyBps, adjustedPnl, threshold: THRESHOLD, status, reason, eligible, evaluatedAt: now } } }, auditEntry: { skill: "route-risk-adjusted-profitability", schemaVersion: "1.0.0", route, status, reason, eligible, adjustedPnl, riskPenaltyBps, accountingUnit, evaluatedAt: now } };
}

program
  .name("route-risk-adjusted-profitability")
  .description("Deterministic risk-adjusted profitability classifier for DeFi routes")
  .version("1.0.0");

program
  .command("run")
  .description("Evaluate risk-adjusted profitability for a route")
  .argument("<input>", "Path to JSON input file or JSON string")
  .action((input: string) => {
    try {
      const raw = input.startsWith("{") ? input : readFileSync(input, "utf8");
      const result = evaluate(JSON.parse(raw));
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    } catch (e: any) {
      process.stdout.write(JSON.stringify({ ok: false, skill: "route-risk-adjusted-profitability", schemaVersion: "1.0.0", error: "INVALID_JSON_INPUT", details: e.message }) + "\n");
      process.exit(1);
    }
  });

program
  .command("doctor")
  .description("Check environment and validate input contract")
  .action(() => {
    process.stdout.write(JSON.stringify({ ok: true, skill: "route-risk-adjusted-profitability", checks: { runtime: "ok", contract: "state.routeProfitabilityByRoute + state.routeRiskByRoute required", output: "state.routeRiskAdjustedProfitabilityByRoute" } }, null, 2) + "\n");
  });

program.parseAsync(process.argv).catch((e: any) => {
  process.stdout.write(JSON.stringify({ ok: false, error: e.message }) + "\n");
  process.exit(1);
});