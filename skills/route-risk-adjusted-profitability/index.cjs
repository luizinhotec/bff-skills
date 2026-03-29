'use strict';

const fs = require('fs');
const path = require('path');

const SKILL_NAME = 'route-risk-adjusted-profitability';
const SCHEMA_VERSION = '1.0.0';
const THRESHOLD = 100;
const ISO_UTC_MILLIS_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function fail(error, details) {
  return {
    ok: false,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    error,
    details: details || undefined
  };
}

function requireUtcTimestamp(value) {
  if (!isNonEmptyString(value) || !ISO_UTC_MILLIS_PATTERN.test(value)) {
    throw new Error('MISSING_OR_INVALID_NOW');
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error('MISSING_OR_INVALID_NOW');
  }

  return value;
}

function parsePayload(payload) {
  if (!isObject(payload)) {
    throw new Error('INVALID_PAYLOAD');
  }

  if (!isObject(payload.input)) {
    throw new Error('INVALID_INPUT_WRAPPER');
  }

  if (!isObject(payload.state)) {
    throw new Error('INVALID_STATE');
  }

  const route = payload.input.route;
  if (!isNonEmptyString(route)) {
    throw new Error('MISSING_ROUTE');
  }

  return {
    route: route.trim(),
    state: payload.state,
    now: requireUtcTimestamp(payload.now)
  };
}

function validateSnapshotContainer(state, containerName, errorCode) {
  if (!(containerName in state)) {
    return null;
  }

  const container = state[containerName];
  if (!isObject(container)) {
    throw new Error(errorCode);
  }

  return container;
}

function readProfitabilitySnapshot(state, route) {
  const container = validateSnapshotContainer(state, 'routeProfitabilityByRoute', 'INVALID_ROUTE_PROFITABILITY_STATE');

  if (container === null || !(route in container)) {
    return null;
  }

  const snapshot = container[route];
  if (!isObject(snapshot)) {
    throw new Error('INVALID_PROFITABILITY_SNAPSHOT');
  }

  if (!Number.isSafeInteger(snapshot.pnl)) {
    throw new Error('INVALID_PNL');
  }

  if (!isNonEmptyString(snapshot.accountingUnit)) {
    throw new Error('INVALID_ACCOUNTING_UNIT');
  }

  return {
    pnl: snapshot.pnl,
    accountingUnit: snapshot.accountingUnit.trim()
  };
}

function readRiskSnapshot(state, route) {
  const container = validateSnapshotContainer(state, 'routeRiskByRoute', 'INVALID_ROUTE_RISK_STATE');

  if (container === null || !(route in container)) {
    return null;
  }

  const snapshot = container[route];
  if (!isObject(snapshot)) {
    throw new Error('INVALID_RISK_SNAPSHOT');
  }

  const riskScore = snapshot.riskScore;
  if (typeof riskScore !== 'number' || !Number.isFinite(riskScore) || riskScore < 0 || riskScore > 1) {
    throw new Error('INVALID_RISK_SCORE');
  }

  return { riskScore };
}

function buildUnknownResult({ route, now, reason }) {
  const decision = {
    route,
    status: 'UNKNOWN',
    reason,
    eligible: false,
    evaluatedAt: now
  };

  return {
    ok: true,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    decision,
    metrics: {
      threshold: THRESHOLD
    },
    stateUpdates: {
      routeRiskAdjustedProfitabilityByRoute: {
        [route]: {
          schemaVersion: SCHEMA_VERSION,
          route,
          status: 'UNKNOWN',
          reason,
          eligible: false,
          threshold: THRESHOLD,
          evaluatedAt: now
        }
      }
    },
    auditEntry: {
      skill: SKILL_NAME,
      schemaVersion: SCHEMA_VERSION,
      route,
      status: 'UNKNOWN',
      reason,
      eligible: false,
      evaluatedAt: now
    }
  };
}

function classify(adjustedPnl) {
  if (adjustedPnl <= 0) {
    return {
      status: 'REJECT',
      reason: 'ADJUSTED_PNL_NOT_POSITIVE',
      eligible: false
    };
  }

  if (adjustedPnl < THRESHOLD) {
    return {
      status: 'LOW_ATTRACTIVENESS',
      reason: 'ADJUSTED_PNL_BELOW_THRESHOLD',
      eligible: false
    };
  }

  return {
    status: 'ATTRACTIVE',
    reason: 'ADJUSTED_PNL_MEETS_THRESHOLD',
    eligible: true
  };
}

function run(payload) {
  let normalized;

  try {
    normalized = parsePayload(payload);
  } catch (error) {
    return fail(error.message);
  }

  const { route, state, now } = normalized;

  let profitabilitySnapshot;
  let riskSnapshot;

  try {
    profitabilitySnapshot = readProfitabilitySnapshot(state, route);
    riskSnapshot = readRiskSnapshot(state, route);
  } catch (error) {
    return fail(error.message, { route });
  }

  if (profitabilitySnapshot === null) {
    return buildUnknownResult({ route, now, reason: 'MISSING_PROFITABILITY_SNAPSHOT' });
  }

  if (riskSnapshot === null) {
    return buildUnknownResult({ route, now, reason: 'MISSING_RISK_SNAPSHOT' });
  }

  const riskPenaltyBps = Math.round(riskSnapshot.riskScore * 10000);
  const adjustedPnl = Math.floor(profitabilitySnapshot.pnl * (10000 - riskPenaltyBps) / 10000);
  const classification = classify(adjustedPnl);

  const decision = {
    route,
    status: classification.status,
    reason: classification.reason,
    eligible: classification.eligible,
    evaluatedAt: now
  };

  const metrics = {
    accountingUnit: profitabilitySnapshot.accountingUnit,
    pnl: profitabilitySnapshot.pnl,
    riskScore: riskSnapshot.riskScore,
    riskPenaltyBps,
    adjustedPnl,
    threshold: THRESHOLD
  };

  return {
    ok: true,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    decision,
    metrics,
    stateUpdates: {
      routeRiskAdjustedProfitabilityByRoute: {
        [route]: {
          schemaVersion: SCHEMA_VERSION,
          route,
          accountingUnit: profitabilitySnapshot.accountingUnit,
          pnl: profitabilitySnapshot.pnl,
          riskScore: riskSnapshot.riskScore,
          riskPenaltyBps,
          adjustedPnl,
          threshold: THRESHOLD,
          status: classification.status,
          reason: classification.reason,
          eligible: classification.eligible,
          evaluatedAt: now
        }
      }
    },
    auditEntry: {
      skill: SKILL_NAME,
      schemaVersion: SCHEMA_VERSION,
      route,
      status: classification.status,
      reason: classification.reason,
      eligible: classification.eligible,
      adjustedPnl,
      riskPenaltyBps,
      accountingUnit: profitabilitySnapshot.accountingUnit,
      evaluatedAt: now
    }
  };
}

function readPayloadFromCli() {
  const inputPath = process.argv[2];

  if (inputPath) {
    return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), inputPath), 'utf8'));
  }

  const stdin = fs.readFileSync(0, 'utf8').trim();
  if (!stdin) {
    throw new Error('MISSING_INPUT');
  }

  return JSON.parse(stdin);
}

if (require.main === module) {
  try {
    const payload = readPayloadFromCli();
    const result = run(payload);
    const output = JSON.stringify(result, null, 2);

    if (!result.ok) {
      process.stdout.write(output + '\n');
      process.exit(1);
    }

    process.stdout.write(output + '\n');
  } catch (error) {
    process.stdout.write(JSON.stringify({
      ok: false,
      skill: SKILL_NAME,
      schemaVersion: SCHEMA_VERSION,
      error: error.message === 'MISSING_INPUT' ? error.message : 'INVALID_JSON_INPUT'
    }, null, 2) + '\n');
    process.exit(1);
  }
}

module.exports = {
  run
};
