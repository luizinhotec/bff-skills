---
name: route-profitability-estimator
description: A deterministic, isolated, reusable profitability estimation skill for DeFi routes.
author: luizinhotec
author_agent: Codex
user-invocable: false
arguments: run
entry: route-profitability-estimator/index.cjs
requires: [state]
tags:
  - defi
  - infrastructure
  - read-only
  - deterministic
  - state-driven
---

# Route Profitability Estimator

## Responsibility

Estimate whether a swap route is economically viable after fees and slippage.

## Why agents need it

Execution without profitability awareness leads to losses.
This skill makes profitability explicit, testable, and composable before any execution step.

## Design principles

- isolated
- reusable
- composable
- deterministic
- no logic in runtime
- state-driven decisions

## Input

```json
{
  "route": "sbtc_to_usdc",
  "amountIn": 100000,
  "state": {
    "marketQuotesByRoute": {
      "sbtc_to_usdc": {
        "expectedOut": 98000,
        "feeBps": 30,
        "slippageBps": 50
      }
    }
  }
}
```

The skill also accepts the catalog wrapper payload:

```json
{
  "input": {
    "route": "sbtc_to_usdc",
    "amountIn": 100000
  },
  "state": {}
}
```

## Processing

Flow:

`input -> processing -> output -> state`

Math rules:

1. `fee = amountIn * feeBps / 10000`
2. `slippage = amountIn * slippageBps / 10000`
3. `netOut = expectedOut - fee - slippage`

Decision rules:

1. if `expectedOut` is missing -> `UNKNOWN`
2. if `netOut <= 0` -> `UNPROFITABLE`
3. if `netOut < amountIn` -> `UNPROFITABLE_AFTER_COSTS`
4. if `netOut >= amountIn` -> `PROFITABLE`

## Output

```json
{
  "ok": true,
  "skill": "route-profitability-estimator",
  "route": "sbtc_to_usdc",
  "profitable": false,
  "netOut": 96500,
  "costs": {
    "fee": 300,
    "slippage": 500
  },
  "reason": "UNPROFITABLE_AFTER_COSTS",
  "stateUpdates": {
    "routeProfitabilityByRoute": {
      "sbtc_to_usdc": {
        "profitable": false,
        "netOut": 96500,
        "evaluatedAt": "2026-03-27T00:00:00.000Z"
      }
    }
  }
}
```

## State read

- `marketQuotesByRoute.<route>`

## State write

- `routeProfitabilityByRoute.<route>`

Written shape:

```json
{
  "profitable": false,
  "netOut": 96500,
  "evaluatedAt": "2026-03-27T00:00:00.000Z"
}
```

## Composition

This skill composes cleanly with route selection, execution readiness, or policy skills because it only reads route quote state and writes a structured profitability summary back into shared state.

## External effects

None. This skill does not fetch external data, call wallets, or modify the runtime.
