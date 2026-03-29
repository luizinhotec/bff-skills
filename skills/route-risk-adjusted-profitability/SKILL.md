---
name: route-risk-adjusted-profitability
description: "Deterministic adjusted-pnl classification using canonical route profitability and risk snapshots from shared state."
metadata:
  author: "luizinhotec"
  author-agent: "Codex"
  user-invocable: "false"
  arguments: "run"
  entry: "route-risk-adjusted-profitability/index.cjs"
  requires: "state"
  tags: "defi, deterministic, state-driven, analytics, composition"
---

# Route Risk Adjusted Profitability

## What it does

Transform one route `pnl` snapshot into one deterministic `adjustedPnl` decision by applying an explicit risk penalty from canonical shared state.

This skill does not call another skill.
It consumes canonical shared-state snapshots only.

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
        "pnl": 500
      }
    },
    "routeRiskByRoute": {
      "sbtc_to_usdc": {
        "riskScore": 0.5
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

## State Read

- `routeProfitabilityByRoute.<route>.pnl`
- `routeProfitabilityByRoute.<route>.accountingUnit`
- `routeRiskByRoute.<route>.riskScore`

## Independence

- no direct dependency on another skill
- no network access
- no runtime chaining
- no hidden runtime logic

Missing snapshots are treated as explicit `UNKNOWN`, not as runtime failure.

## Numeric Domain

- `pnl`: safe integer
- `riskScore`: number in closed interval `[0, 1]`
- `accountingUnit`: non-empty string

`pnl` may be negative.
Negative `pnl` is valid and flows through normal classification.

## Math

Frozen public math:

1. `riskPenaltyBps = round(riskScore * 10000)`
2. `adjustedPnl = floor(pnl * (10000 - riskPenaltyBps) / 10000)`

`threshold = 100`

Interpretation:

- `100` means `100` minor units of `accountingUnit`
- if `accountingUnit` is `usd_cents`, threshold means USD 1.00 adjusted pnl

## Decision Rule

- missing profitability snapshot -> `UNKNOWN`
- missing risk snapshot -> `UNKNOWN`
- `adjustedPnl <= 0` -> `REJECT`
- `0 < adjustedPnl < 100` -> `LOW_ATTRACTIVENESS`
- `adjustedPnl >= 100` -> `ATTRACTIVE`

## Success Output Contract

Every success output includes:

- `ok: true`
- `skill: "route-risk-adjusted-profitability"`
- `schemaVersion: "1.0.0"`
- `decision`
- `metrics`
- `stateUpdates`
- `auditEntry`

`decision` is an object and `status` is a field inside `decision`.

Canonical attractive example:

```json
{
  "ok": true,
  "skill": "route-risk-adjusted-profitability",
  "schemaVersion": "1.0.0",
  "decision": {
    "route": "sbtc_to_usdc",
    "status": "ATTRACTIVE",
    "reason": "ADJUSTED_PNL_MEETS_THRESHOLD",
    "eligible": true,
    "evaluatedAt": "2026-03-28T00:00:00.000Z"
  },
  "metrics": {
    "accountingUnit": "usd_cents",
    "pnl": 500,
    "riskScore": 0.5,
    "riskPenaltyBps": 5000,
    "adjustedPnl": 250,
    "threshold": 100
  }
}
```

For `UNKNOWN`, the output remains a success:

```json
{
  "ok": true,
  "skill": "route-risk-adjusted-profitability",
  "schemaVersion": "1.0.0",
  "decision": {
    "route": "missing_route",
    "status": "UNKNOWN",
    "reason": "MISSING_PROFITABILITY_SNAPSHOT",
    "eligible": false,
    "evaluatedAt": "2026-03-28T00:00:00.000Z"
  },
  "metrics": {
    "threshold": 100
  }
}
```

## Error Contract

Every error output includes:

- `ok: false`
- `skill: "route-risk-adjusted-profitability"`
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
- `INVALID_ROUTE_RISK_STATE`
- `INVALID_PROFITABILITY_SNAPSHOT`
- `INVALID_RISK_SNAPSHOT`
- `INVALID_PNL`
- `INVALID_ACCOUNTING_UNIT`
- `INVALID_RISK_SCORE`
- `INVALID_JSON_INPUT`
- `MISSING_INPUT`

## State Write

- `routeRiskAdjustedProfitabilityByRoute.<route>`

## Required Validation Cases

- attractive case
- reject case from full penalty
- low-attractiveness case
- unknown from missing profitability snapshot
- unknown from missing risk snapshot
- invalid risk score above `1`
- invalid negative risk score
- invalid pnl type

## How To Run

Run one fixture:

```bash
node skills/route-risk-adjusted-profitability/run-example.cjs skills/route-risk-adjusted-profitability/examples/attractive.json
```

Run all fixtures:

```bash
node skills/route-risk-adjusted-profitability/validate-examples.cjs
```

Run implementation directly:

```bash
node skills/route-risk-adjusted-profitability/index.cjs skills/route-risk-adjusted-profitability/examples/attractive.json
```


## Why agents need it
Downstream consumers need a normalized profitability-under-risk signal.

## Safety notes
Does not execute routes or transactions. Missing snapshots treated as UNKNOWN.
