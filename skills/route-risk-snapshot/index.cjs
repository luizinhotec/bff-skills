'use strict';

const fs = require('fs');
const path = require('path');

const SKILL_NAME = 'route-risk-snapshot';
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

function classifyFromPnl(pnl) {
  if (pnl <= 0) {
    return {
      riskScore: 1,
      riskLevel: 'HIGH',
      reason: 'NON_POSITIVE_PNL_BOOTSTRAP_RISK'
    };
  }

  if (pnl < THRESHOLD) {
    return {
      riskScore: 0.5,
      riskLevel: 'MEDIUM',
      reason: 'SUB_THRESHOLD_PNL_BOOTSTRAP_RISK'
    };
  }

  return {
    riskScore: 0,
    riskLevel: 'LOW',
    reason: 'THRESHOLD_MEETING_PNL_BOOTSTRAP_RISK'
  };
}

function buildUnknownResult({ route, now }) {
  const snapshot = {
    route,
    riskScore: null,
    riskLevel: 'UNKNOWN',
    signals: {
      profitabilitySignal: 'MISSING_PROFITABILITY_SNAPSHOT'
    },
    reason: 'MISSING_PROFITABILITY_SNAPSHOT',
    evaluatedAt: now
  };

  return {
    ok: true,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    snapshot,
    stateUpdates: {
      routeRiskByRoute: {
        [route]: {
          schemaVersion: SCHEMA_VERSION,
          ...snapshot
        }
      }
    },
    auditEntry: {
      skill: SKILL_NAME,
      schemaVersion: SCHEMA_VERSION,
      route,
      riskLevel: 'UNKNOWN',
      reason: 'MISSING_PROFITABILITY_SNAPSHOT',
      evaluatedAt: now
    }
  };
}

function buildSignals({ pnl, accountingUnit }) {
  return {
    profitabilitySignal: pnl <= 0 ? 'NON_POSITIVE' : (pnl < THRESHOLD ? 'SUB_THRESHOLD' : 'THRESHOLD_MET'),
    pnl,
    threshold: THRESHOLD,
    accountingUnit
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

  try {
    profitabilitySnapshot = readProfitabilitySnapshot(state, route);
  } catch (error) {
    return fail(error.message, { route });
  }

  if (profitabilitySnapshot === null) {
    return buildUnknownResult({ route, now });
  }

  const classification = classifyFromPnl(profitabilitySnapshot.pnl);
  const snapshot = {
    route,
    riskScore: classification.riskScore,
    riskLevel: classification.riskLevel,
    signals: buildSignals({
      pnl: profitabilitySnapshot.pnl,
      accountingUnit: profitabilitySnapshot.accountingUnit
    }),
    reason: classification.reason,
    evaluatedAt: now
  };

  return {
    ok: true,
    skill: SKILL_NAME,
    schemaVersion: SCHEMA_VERSION,
    snapshot,
    stateUpdates: {
      routeRiskByRoute: {
        [route]: {
          schemaVersion: SCHEMA_VERSION,
          ...snapshot
        }
      }
    },
    auditEntry: {
      skill: SKILL_NAME,
      schemaVersion: SCHEMA_VERSION,
      route,
      riskScore: classification.riskScore,
      riskLevel: classification.riskLevel,
      reason: classification.reason,
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
      console.error(output);
      process.exit(1);
    }

    process.stdout.write(output + '\n');
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      skill: SKILL_NAME,
      schemaVersion: SCHEMA_VERSION,
      error: error.message === 'MISSING_INPUT' ? error.message : 'INVALID_JSON_INPUT'
    }, null, 2));
    process.exit(1);
  }
}

module.exports = {
  run
};
