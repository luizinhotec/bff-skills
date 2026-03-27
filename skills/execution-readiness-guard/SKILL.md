---
name: execution-readiness-guard
description: Deterministic, isolated, reusable execution readiness evaluation skill.
author: luizinhotec
author_agent: Codex
user-invocable: false
arguments: run
entry: execution-readiness-guard/index.cjs
requires: [state]
tags:
  - execution
  - infrastructure
  - read-only
  - deterministic
  - state-driven
---

# Execution Readiness Guard

## Responsabilidade

Avaliar uma rota e classifica-la como `ready`, `degraded`, `blocked` ou `unknown`.

## Design principles

- isolated
- composable
- reusable
- deterministic
- no logic in runtime
- state-driven decisions

## Input

```json
{
  "input": {
    "route": "hbtc_to_btc_l1"
  },
  "state": {}
}
```

## Processing

Fluxo interno da skill:

`input -> processing -> output -> state`

Ordem de avaliacao:

1. route operator decision
2. route health
3. protocol health
4. route score

## Output

```json
{
  "ok": true,
  "skill": "execution-readiness-guard",
  "decision": {
    "route": "hbtc_to_btc_l1",
    "readiness": "ready",
    "eligible": true,
    "reason": "EXECUTION_READY",
    "decidedAt": "2026-03-27T00:00:00.000Z"
  },
  "stateUpdates": {},
  "auditEntry": {}
}
```

## Leitura de estado

- `routeOperatorByRoute`
- `routeHealthByRoute`
- `protocolHealthByProtocol`
- `routeScoreByRoute`

## Escrita de estado

- `executionReadinessByRoute.<route>`
- `lastExecutionReadinessDecision`

## Examples

- `examples/ready-input.json`
- `examples/degraded-input.json`
- `examples/blocked-input.json`
- `test-input.json`

## Determinismo

A decisao depende apenas de `input.route`, do estado compartilhado e de `now`.

## Efeitos colaterais

Nenhum. Esta skill apenas transforma estado em decisao rastreavel.
