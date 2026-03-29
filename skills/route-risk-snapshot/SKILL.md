---
name: route-risk-snapshot
description: "Deterministic bootstrap risk snapshot per route derived only from confirmed profitability evidence in shared state."
metadata:
  author: "luizinhotec"
  author-agent: "Codex"
  user-invocable: "false"
  arguments: "run"
  entry: "route-risk-snapshot/index.cjs"
  requires: "state"
  tags: "defi, deterministic, state-driven, analytics, state-writer, composition"
---

# Route Risk Snapshot

## Responsibility

Produce one canonical, minimal and deterministic risk snapshot per route for downstream consumption.

This skill is intentionally a bootstrap risk producer.
It uses only confirmed profitability evidence already available in shared state.

This skill does not:

- act as an execution gate
- act as a readiness checker
- claim full market, protocol or execution risk coverage

## Input Contract

This skill accepts only the catalog wrapper payload.

```json
{
  "input": {
    "route": "sbtc_to_usdc"
  },
  "state": {
    "routeProfitabilityByRoute": {
      "sbtc_to_usdc": {
        "accountingUnit": "usd_cents",
        "pnl": 80
      }
    }
  },
  "now": "2026-03-28T00:00:00.000Z"
}
```

Required fields:

- `input.route`: non-empty string after trimming
- `state`: object
- `now`: canonical UTC timestamp in exact `YYYY-MM-DDTHH:mm:ss.sssZ`

## Confirmed Upstream Evidence

This skill reads only:

- `routeProfitabilityByRoute.<route>.pnl`
- `routeProfitabilityByRoute.<route>.accountingUnit`

No other upstream risk signal is assumed.

That means the emitted `riskScore` is a bootstrap proxy derived from confirmed profitability evidence only.

## State Read

- `routeProfitabilityByRoute.<route>.pnl`
- `routeProfitabilityByRoute.<route>.accountingUnit`

## State Write

- `routeRiskByRoute.<route>`

This write path is the canonical Day 4 producer contract.

## Isolation

- no direct dependency on another skill
- no network access
- no runtime chaining
- no hidden runtime logic

Missing profitability snapshot is treated as explicit `UNKNOWN`, not as runtime failure.

## Numeric Domain

- `pnl`: safe integer
- `accountingUnit`: non-empty string

`pnl` may be negative.
Negative `pnl` is valid and flows through normal classification.

## Bootstrap Score Rule

Frozen public score rule:

1. `pnl <= 0` -> `riskScore = 1`, `riskLevel = HIGH`
2. `0 < pnl < 100` -> `riskScore = 0.5`, `riskLevel = MEDIUM`
3. `pnl >= 100` -> `riskScore = 0`, `riskLevel = LOW`

`threshold = 100`

Interpretation:

- `100` means `100` minor units of `accountingUnit`
- if `accountingUnit` is `usd_cents`, threshold means USD 1.00 pnl

Semantic boundary:

- this is a minimum bootstrap risk proxy
- this is not a full risk engine
- this is not a substitute for richer future upstream signals

## Success Output Contract

Every success output includes:

- `ok: true`
- `skill: "route-risk-snapshot"`
- `schemaVersion: "1.0.0"`
- `snapshot`
- `stateUpdates`
- `auditEntry`

Canonical medium-risk example:

```json
{
  "ok": true,
  "skill": "route-risk-snapshot",
  "schemaVersion": "1.0.0",
  "snapshot": {
    "route": "sbtc_to_usdc",
    "riskScore": 0.5,
    "riskLevel": "MEDIUM",
    "signals": {
      "profitabilitySignal": "SUB_THRESHOLD",
      "pnl": 80,
      "threshold": 100,
      "accountingUnit": "usd_cents"
    },
    "reason": "SUB_THRESHOLD_PNL_BOOTSTRAP_RISK",
    "evaluatedAt": "2026-03-28T00:00:00.000Z"
  }
}
```

For `UNKNOWN`, the output remains a success:

```json
{
  "ok": true,
  "skill": "route-risk-snapshot",
  "schemaVersion": "1.0.0",
  "snapshot": {
    "route": "missing_route",
    "riskScore": null,
    "riskLevel": "UNKNOWN",
    "signals": {
      "profitabilitySignal": "MISSING_PROFITABILITY_SNAPSHOT"
    },
    "reason": "MISSING_PROFITABILITY_SNAPSHOT",
    "evaluatedAt": "2026-03-28T00:00:00.000Z"
  }
}
```

## Error Contract

Every error output includes:

- `ok: false`
- `skill: "route-risk-snapshot"`
- `schemaVersion: "1.0.0"`
- `error`
- optional `details`

Documented error codes:

- `INVALID_PAYLOAD`
- `INVALID_INPUT_WRAPPER`
- `INVALID_STATE`
- `MISSING_OR_INVALID_NOW`
- `MISSING_ROUTE`
- `INVALID_ROUTE_PROFITABILITY_STATE`
- `INVALID_PROFITABILITY_SNAPSHOT`
- `INVALID_PNL`
- `INVALID_ACCOUNTING_UNIT`
- `INVALID_JSON_INPUT`
- `MISSING_INPUT`

## Signals Contract

`signals` is intentionally rigid.
The initial implementation contains only:

- `profitabilitySignal`
- `pnl`
- `threshold`
- `accountingUnit`

It must not become an open-ended bag of ad hoc fields.

## Reuse And Composition

Downstream consumers can use:

- `snapshot.riskScore` for deterministic penalty logic
- `snapshot.riskLevel` for coarse classification
- `stateUpdates.routeRiskByRoute.<route>` as durable shared state
- `auditEntry` for traceability

This skill exists to produce the upstream contract that a future consumer can read without inventing hidden logic.

## What This Skill Does Not Do

- execute routes
- block execution
- merge readiness or health concerns
- fetch external data
- claim comprehensive risk measurement

## Validation Fixtures

Executable fixtures live in `skills/route-risk-snapshot/examples/`.
Each `*.json` may have a companion `*.expected.json` file.
`run-example.cjs` executes the skill and fails when the current output diverges from the expected output.

Coverage included:

- low risk from high pnl
- medium risk from sub-threshold pnl
- high risk from zero pnl
- high risk from negative pnl
- missing profitability snapshot -> `UNKNOWN`
- invalid pnl rejection
- blank route rejection
- invalid timestamp rejection

Run one fixture:

```bash
node skills/route-risk-snapshot/run-example.cjs skills/route-risk-snapshot/examples/medium-risk.json
```

Run all fixtures:

```bash
node skills/route-risk-snapshot/validate-examples.cjs
```

Run implementation directly:

```bash
node skills/route-risk-snapshot/index.cjs skills/route-risk-snapshot/examples/medium-risk.json
```
