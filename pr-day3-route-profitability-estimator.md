Submission for AIBTC Skills Competition Day 3.

Skill: route-profitability-estimator

Summary:
A deterministic, isolated, reusable profitability estimation skill for DeFi routes.

What it does:
- estimates net output after fees and slippage
- determines if a route is economically viable
- enables agents to make better execution decisions
- reads `marketQuotesByRoute[route]` from shared state
- writes `stateUpdates.routeProfitabilityByRoute[route]`
- keeps all profitability logic inside the skill
- uses deterministic math-only evaluation
- includes runnable examples with `node`

Why it matters:
Execution without profitability awareness leads to losses.
This skill makes profitability explicit, testable, and composable.

Architecture:
- no business logic in runtime
- shared-state input and structured state output
- isolated, reusable, and composable by design
