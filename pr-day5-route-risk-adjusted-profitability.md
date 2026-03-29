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

This makes downstream route comparison more realistic, modular, and competition-ready.
