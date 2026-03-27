Submission for AIBTC Skills Competition Day 2.

Skill: execution-readiness-guard

Summary:
Deterministic, isolated, reusable execution readiness evaluation skill.

Design principles:
- isolated
- composable
- reusable
- deterministic
- no logic in runtime
- state-driven decisions

Behavior:
- evaluates route readiness
- returns: ready | degraded | blocked | unknown
- reads shared state
- writes structured output
- executes independently from other skills
- does not perform irreversible external side effects

Input:
- `input.route`
- shared `state`
- optional `now` for deterministic timestamps

Output:
- `decision`
- `stateUpdates`
- `auditEntry`
- strict structured JSON result

Catalog adherence:
- logic stays inside the skill
- runtime remains a simple orchestrator
- composition happens through shared state
- no direct dependency on other skills
- examples included for isolated execution

Files:
- skills/execution-readiness-guard/SKILL.md
- skills/execution-readiness-guard/index.cjs
- skills/execution-readiness-guard/examples/
- skills/execution-readiness-guard/run-example.cjs
- skills/execution-readiness-guard/test-input.json
