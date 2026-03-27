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

Files:
- skills/execution-readiness-guard/SKILL.md
- implementation
- test scripts
