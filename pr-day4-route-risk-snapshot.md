Day 4 submission draft for AIBTC Skills Competition.

Skill: `route-risk-snapshot`

Final status:
- implementation complete
- local validation passed
- submission text ready for internal review
- PR opened: https://github.com/BitflowFinance/bff-skills/pull/69

Suggested compare:
- base: `competition/main`
- head: `submit-day4-route-risk-snapshot`

Scope:
- `skills/route-risk-snapshot/SKILL.md`
- `skills/route-risk-snapshot/index.cjs`
- `skills/route-risk-snapshot/run-example.cjs`
- `skills/route-risk-snapshot/validate-examples.cjs`
- `skills/route-risk-snapshot/examples/*.json`
- `skills/route-risk-snapshot/examples/*.expected.json`

Why this Day 4 exists:
- the original Day 4 candidate depended on an external risk contract that was not confirmed upstream
- shipping a consumer before a confirmed producer would create a weak competitive story
- this Day 4 fixes the pipeline order by creating the canonical shared-state risk producer first

Core positioning:
- this is a catalog skill
- this is a producer
- this is not a gate
- this is not a readiness checker
- this is not a full risk engine
- this is a canonical bootstrap risk layer built only from confirmed upstream evidence

What this skill does:
- reads one profitability snapshot from shared state
- derives one deterministic bootstrap risk snapshot from confirmed `pnl` evidence
- classifies the route as `HIGH`, `MEDIUM`, `LOW`, or `UNKNOWN`
- writes a canonical downstream-consumable snapshot to `stateUpdates.routeRiskByRoute[route]`

What this skill does not claim:
- it does not measure full market risk
- it does not measure full execution risk
- it does not measure protocol risk
- it does not execute routes
- it does not gate execution
- it does not fetch external data

Critical competition framing:
- this PR intentionally chooses architectural honesty over inflated semantics
- the skill does not invent upstream risk fields that do not exist
- the skill creates a reusable risk contract using only evidence already confirmed in shared state
- the semantic claim is narrow: bootstrap risk proxy, not comprehensive risk model

Canonical state read:
- `state.routeProfitabilityByRoute[route].pnl`
- `state.routeProfitabilityByRoute[route].accountingUnit`

Canonical state write:
- `stateUpdates.routeRiskByRoute[route]`

Why `pnl` is used here:
- `pnl` is the confirmed upstream evidence already available in the catalog pipeline
- using `pnl` avoids inventing a fake risk contract just to satisfy a downstream consumer
- this gives the catalog a canonical risk producer now, while leaving room for richer upstream risk signals later

Public bootstrap rule:
- `pnl <= 0` -> `riskScore = 1`, `riskLevel = HIGH`
- `0 < pnl < 100` -> `riskScore = 0.5`, `riskLevel = MEDIUM`
- `pnl >= 100` -> `riskScore = 0`, `riskLevel = LOW`

Threshold policy:
- fixed threshold: `100`
- interpretation: `100` minor units of the declared `accountingUnit`
- example: if `accountingUnit` is `usd_cents`, threshold means USD 1.00 pnl

Why this rule is right for Day 4:
- deterministic
- easy to explain
- based only on confirmed inputs
- enough to establish producer-before-consumer composition
- intentionally limited to bootstrap semantics

Defense against the obvious criticism:

Potential criticism:
- "this is just profitability reclassification"

Direct answer:
- partially yes, by design
- the goal is not to pretend the catalog already has a rich upstream risk engine
- the goal is to create the first canonical risk snapshot from confirmed evidence, so downstream skills compose against a real shared-state contract instead of an invented one
- this is a stronger competitive story than claiming unsupported risk semantics

Pipeline positioning:
- Day 3 -> `route-profitability-estimator` writes profitability snapshot
- Day 4 -> `route-risk-snapshot` writes canonical bootstrap risk snapshot
- Day 5 -> `route-risk-adjusted-profitability` can consume profitability + risk without inventing upstream contracts

Why this is a catalog skill instead of a loose script:
- isolated input, output, state read, and state write contract
- deterministic for the same `input + state + now`
- no runtime chaining
- no hidden dependency on another skill execution in the same flow
- fixture-based validation with frozen expected outputs

Success output contract:
- `ok`
- `skill`
- `schemaVersion`
- `snapshot`
- `stateUpdates`
- `auditEntry`

Fast read note:
- `snapshot` is the computed payload
- `stateUpdates` is the canonical persistence of that payload in shared state

Minimum snapshot fields:
- `route`
- `riskScore`
- `riskLevel`
- `signals`
- `reason`
- `evaluatedAt`

Signals contract:
- `profitabilitySignal`
- `pnl`
- `threshold`
- `accountingUnit`

Why `signals` matters:
- it keeps the bootstrap semantics inspectable
- it shows exactly which confirmed evidence produced the snapshot
- it avoids a black-box score

Unknown and error policy:
- missing profitability snapshot -> success output with `UNKNOWN`
- malformed profitability container -> `ok: false`
- malformed profitability snapshot -> `ok: false`
- malformed `pnl` -> `ok: false`
- malformed route -> `ok: false`
- malformed timestamp -> `ok: false`

Validation artifacts included:
- success fixtures for `LOW`, `MEDIUM`, and `HIGH`
- missing profitability snapshot fixture -> `UNKNOWN`
- malformed `pnl` fixture
- blank route fixture
- malformed timestamp fixture
- explicit expected outputs for every documented fixture
- aggregated validator for all fixtures

Fixture matrix:

| Fixture | Expected result | What it proves |
| --- | --- | --- |
| `low-risk.json` | `LOW` | strong confirmed profitability produces low bootstrap risk |
| `medium-risk.json` | `MEDIUM` | positive but sub-threshold profitability produces medium bootstrap risk |
| `high-risk-zero.json` | `HIGH` | zero pnl maps to high bootstrap risk |
| `high-risk-negative.json` | `HIGH` | negative pnl maps to high bootstrap risk |
| `missing-profitability-snapshot.json` | `UNKNOWN` | absence is explicit and deterministic |
| `invalid-pnl.json` | `INVALID_PNL` | malformed upstream value is rejected |
| `invalid-route-blank.json` | `MISSING_ROUTE` | trimmed route contract enforcement |
| `invalid-now.json` | `MISSING_OR_INVALID_NOW` | timestamp contract enforcement |

Validation executed:

```bash
node skills/route-risk-snapshot/validate-examples.cjs
```

Expected validation behavior:
- the validator exits `0` only when every fixture matches its companion `*.expected.json`
- the validator exits `1` if any fixture input cannot be read, any expected file cannot be read, or any actual output drifts from the frozen expectation
- expected business failures such as invalid inputs still count as validation success when the fixture matches its expected error output

Why this improves the competitive story:
- fixes the producer-before-consumer order in the pipeline
- creates a real canonical state contract for risk
- keeps semantics disciplined instead of overstated
- makes the future Day 5 consumer more defensible
- demonstrates catalog maturity through explicit shared-state composition
