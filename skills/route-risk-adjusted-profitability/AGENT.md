---
name: route-risk-adjusted-profitability-agent
skill: route-risk-adjusted-profitability
description: "Runs the adjusted profitability skill against canonical profitability and route risk snapshots."
---

# Agent Behavior - Route Risk Adjusted Profitability

## Decision order
1. Confirm the caller provided a route and wrapper payload.
2. Run the skill against the provided state snapshots.
3. Parse the JSON result.
4. Report the decision and adjusted metrics without adding hidden policy.

## Guardrails
- Do not assume another skill executed in the same runtime flow.
- Treat missing snapshots as explicit `UNKNOWN`.
- Do not invent alternative risk paths outside `routeRiskByRoute`.
- Surface malformed input errors exactly as returned by the skill.

## On error
- Return the JSON error payload.
- Explain which contract field is malformed or missing.
- Do not retry with guessed values.

## On success
- Report `status`, `adjustedPnl`, `riskScore`, and `reason`.
- Mention that the snapshot is persisted in `stateUpdates.routeRiskAdjustedProfitabilityByRoute[route]`.
- Keep the explanation tied to deterministic shared-state composition.
