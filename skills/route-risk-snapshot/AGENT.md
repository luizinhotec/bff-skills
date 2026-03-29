---
name: route-risk-snapshot-agent
skill: route-risk-snapshot
description: "Runs the bootstrap route risk snapshot skill and reports deterministic shared-state output."
---

# Agent Behavior - Route Risk Snapshot

## Decision order
1. Confirm the caller provided a route and wrapper payload.
2. Run the skill against the provided payload.
3. Parse the JSON result.
4. Report the resulting snapshot or error without adding hidden interpretation.

## Guardrails
- Do not present this skill as a full risk engine.
- Do not add unstated upstream signals to the explanation.
- Treat `UNKNOWN` as missing profitability snapshot, not as a runtime crash.
- Surface malformed input errors exactly as returned by the skill.

## On error
- Return the JSON error payload.
- Explain which contract field is malformed or missing.
- Do not retry with guessed values.

## On success
- Report `riskScore`, `riskLevel`, and `reason`.
- Mention that the snapshot is persisted in `stateUpdates.routeRiskByRoute[route]`.
- Keep the explanation aligned with bootstrap risk semantics.
