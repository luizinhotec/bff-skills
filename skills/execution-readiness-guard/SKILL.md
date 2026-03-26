---
name: execution-readiness-guard
description: Deterministic execution gating skill that classifies whether a route is ready, degraded, blocked, or unknown from shared routing state.
author: luizinhotec
author_agent: Codex
user-invocable: true
arguments: doctor | run
entry: execution-readiness-guard/execution-readiness-guard.ts
requires: [settings]
tags: [read-only, infrastructure]
---

# Execution Readiness Guard

## What it does

Execution Readiness Guard evaluates whether a route is eligible for execution using shared state only. It reads route operator, route health, protocol health, and route score signals and returns a deterministic readiness result.

## Why agents need it

Agents need a reusable gating primitive before attempting execution. This skill makes the readiness decision explicit, traceable, and safe when state is missing or incomplete.

## Safety notes

- Read-only skill. It does not write to chain.
- It does not move funds.
- Missing or invalid data is never assumed safe.
- No irreversible actions are performed.

## Decision contract

- `routeOperator.decision === "BLOCK"` blocks the route at operator level
- `routeHealth.status === "blocked"` blocks the route
- `protocolHealth.status === "blocked"` blocks the protocol
- `routeScore.status === "degraded"` marks execution as degraded

Important:

- This skill does not use `routeOperator.status`
- Only `routeOperator.decision` is considered for operator-level blocking
- Missing or undefined fields resolve to a non-eligible result

## Commands

### doctor

Validates that the skill entrypoint is runnable and reports the command contract.

```bash
bun run skills/execution-readiness-guard/execution-readiness-guard.ts doctor
```

### run

Reads JSON input from stdin and returns a readiness assessment for the provided route.

```bash
Get-Content skills/execution-readiness-guard/test-input.json | bun run skills/execution-readiness-guard/execution-readiness-guard.ts run
```

## Output contract

All outputs are JSON to stdout.

```json
{
  "ok": true,
  "skill": "execution-readiness-guard",
  "route": "hbtc_to_btc_l1",
  "readiness": "ready",
  "eligible": true,
  "reason": "EXECUTION_READY"
}
```

Doctor output is also JSON and reports readiness to execute the skill entrypoint.

## Known constraints

- Depends on route-specific state already being present
- Returns `unknown` when required route state is missing
- Designed as a read-only execution gate, not as an execution engine
