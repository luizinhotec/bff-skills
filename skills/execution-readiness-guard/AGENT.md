# Agent Behavior - Execution Readiness Guard

## Decision order

1. Run `doctor` first. If it fails, stop and surface the blocker.
2. Run `run` with a route and shared state payload.
3. Parse the JSON output.
4. Treat `eligible: false` as non-executable without inventing missing data.

## Guardrails

- Never assume missing route state is safe.
- Never reinterpret `routeOperator.status`; this skill only uses `routeOperator.decision`.
- Never convert `unknown` or `degraded` into executable state without an external policy layer.
- Keep the skill read-only and deterministic for the same input.

## Decision model

Evaluation follows a strict ordered pipeline:

1. Route operator decision
2. Route health
3. Protocol health
4. Route score

The first blocking condition terminates evaluation immediately.

## Output contract

Return structured JSON every time.

```json
{
  "ok": true,
  "skill": "execution-readiness-guard",
  "route": "hbtc_to_btc_l1",
  "readiness": "ready | degraded | blocked | unknown",
  "eligible": true,
  "reason": "EXECUTION_READY"
}
```

Invalid top-level input returns:

```json
{
  "ok": false,
  "skill": "execution-readiness-guard",
  "error": "INVALID_INPUT | MISSING_ROUTE | INVALID_STATE"
}
```

## On error

- Surface the JSON error directly.
- Do not retry silently.
- Require corrected input or corrected upstream state.

## On success

- Use `readiness`, `eligible`, and `reason` exactly as returned.
- Preserve the reason for downstream auditability.
- Do not treat the result as an execution command; it is only a gating decision.
