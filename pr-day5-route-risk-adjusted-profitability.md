## What this skill does

`route-risk-adjusted-profitability` is a deterministic evaluation skill that converts raw route profitability into a risk-adjusted profitability view.

It reads the canonical profitability snapshot and the canonical route risk snapshot from shared state, then produces a normalized output that helps downstream ranking and route selection reason about profitability under risk.

This skill does not execute transactions, does not mutate runtime logic, and does not introduce hidden policy in orchestration.

---

## Inputs read

- `input.route`
- `state.routeProfitabilityByRoute[route].pnl`
- `state.routeProfitabilityByRoute[route].accountingUnit`
- `state.routeRiskByRoute[route].riskScore`
- `now`

---

## Output written

- `state.routeRiskAdjustedProfitabilityByRoute[route]`

---

## Why this skill exists

Raw profitability alone is not enough for competitive route selection.

A route may look attractive on gross PnL while carrying worse operational or execution risk than alternatives.

This skill exists to make that tradeoff explicit and composable:
- Day 3 provides route profitability
- Day 4 provides canonical route risk
- Day 5 combines both into a deterministic risk-adjusted profitability signal

This keeps business reasoning inside reusable skills rather than pushing decision logic into runtime.

---

## Risk adjustment model

The skill applies a deterministic penalty to profitability based on the canonical route risk score.

This uses a linear risk penalty model expressed in basis points (bps).

Public model:

- `riskPenaltyBps = round(riskScore * 10000)`
- `adjustedPnl = floor(pnl * (10000 - riskPenaltyBps) / 10000)`

Interpretation:

- `riskScore` is constrained to `[0, 1]`
- higher risk reduces effective profitability proportionally
- the adjustment is deterministic and integer-safe

This gives downstream consumers an explicit and auditable rule instead of hidden ranking logic in runtime.

---

## Edge behavior

- `riskScore = 0` -> full profitability is preserved
- `riskScore = 1` -> profitability is fully neutralized
- negative `pnl` remains negative and flows to rejection
- missing profitability snapshot -> `UNKNOWN`
- missing risk snapshot -> `UNKNOWN`

These cases are covered by local fixtures and frozen expected outputs.

---

## Deterministic behavior

The skill is deterministic for the same input state.

It:
- reads profitability from shared state
- reads canonical risk from shared state
- computes a risk-adjusted profitability value
- writes the result back to shared state in a structured form

No network calls, no hidden external dependencies, and no runtime-only decision branching are required.

---

## Composition role in the pipeline

This skill is a legitimate downstream consumer of:
- `routeProfitabilityByRoute`
- `routeRiskByRoute`

It strengthens the catalog by showing explicit composition across days:
- Day 3 -> profitability producer
- Day 4 -> risk producer
- Day 5 -> profitability-under-risk consumer

This improves comparability across routes while preserving isolated skill boundaries.

---

## Output structure

The skill writes:

```json
{
  "routeRiskAdjustedProfitabilityByRoute": {
    "<route>": {
      "route": "sbtc_to_usdc",
      "accountingUnit": "usd_cents",
      "pnl": 500,
      "riskScore": 0.5,
      "riskPenaltyBps": 5000,
      "adjustedPnl": 250,
      "threshold": 100,
      "status": "ATTRACTIVE",
      "reason": "ADJUSTED_PNL_MEETS_THRESHOLD",
      "eligible": true,
      "evaluatedAt": "2026-03-28T00:00:00.000Z"
    }
  }
}
```

Meaning:

- `pnl` preserves the raw profitability input
- `riskScore` preserves the canonical route risk input
- `riskPenaltyBps` makes the penalty model explicit and auditable
- `adjustedPnl` is the normalized profitability-under-risk value
- `status` makes the result usable for ranking and selection flows

---

## Validation

Validated locally with:
- `node skills/route-risk-adjusted-profitability/validate-examples.cjs`
- `node skills/route-risk-adjusted-profitability/index.cjs skills/route-risk-adjusted-profitability/test-input.json`

Both passed against the canonical Day 4 contract:
- `state.routeRiskByRoute[route].riskScore`

---

## Repository structure

Included under:

- `skills/route-risk-adjusted-profitability/SKILL.md`
- `skills/route-risk-adjusted-profitability/AGENT.md`
- `skills/route-risk-adjusted-profitability/index.cjs`
- `skills/route-risk-adjusted-profitability/test-input.json`
- supporting examples and validation files

---

## Competitive value

This submission adds a stronger ranking primitive to the catalog:
- profitability alone can overstate route attractiveness
- risk alone can over-penalize useful routes
- risk-adjusted profitability creates a more decision-relevant metric

This skill enables safer capital allocation by preventing high-risk routes from dominating rankings purely based on raw profitability.

This skill prevents high-risk routes from dominating rankings purely based on raw profitability, enabling safer and more capital-efficient route selection.

This makes downstream route comparison more realistic, modular, and competition-ready.
