'use strict';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildUnknown(route, reason, now) {
  return {
    route,
    readiness: 'unknown',
    eligible: false,
    reason,
    decidedAt: now
  };
}

function buildDecision(route, state, now) {
  const routeOperator = state.routeOperatorByRoute?.[route] ?? null;
  const routeHealth = state.routeHealthByRoute?.[route] ?? null;
  const routeScore = state.routeScoreByRoute?.[route] ?? null;

  if (!routeOperator) {
    return buildUnknown(route, 'MISSING_ROUTE_OPERATOR', now);
  }

  if (!routeHealth) {
    return buildUnknown(route, 'MISSING_ROUTE_HEALTH', now);
  }

  if (!routeScore) {
    return buildUnknown(route, 'MISSING_ROUTE_SCORE', now);
  }

  const protocol = routeOperator.protocol;
  if (typeof protocol !== 'string' || !protocol.trim()) {
    return buildUnknown(route, 'MISSING_PROTOCOL_REFERENCE', now);
  }

  const protocolHealth = state.protocolHealthByProtocol?.[protocol] ?? null;
  if (!protocolHealth) {
    return buildUnknown(route, 'MISSING_PROTOCOL_HEALTH', now);
  }

  if (routeOperator.decision === 'BLOCK') {
    return {
      route,
      readiness: 'blocked',
      eligible: false,
      reason: routeOperator.reason || 'ROUTE_OPERATOR_BLOCKED',
      decidedAt: now
    };
  }

  if (routeHealth.status === 'blocked') {
    return {
      route,
      readiness: 'blocked',
      eligible: false,
      reason: routeHealth.reason || 'ROUTE_HEALTH_BLOCKED',
      decidedAt: now
    };
  }

  if (protocolHealth.status === 'blocked') {
    return {
      route,
      readiness: 'blocked',
      eligible: false,
      reason: protocolHealth.reason || 'PROTOCOL_BLOCKED',
      decidedAt: now
    };
  }

  if (routeScore.status === 'degraded') {
    return {
      route,
      readiness: 'degraded',
      eligible: false,
      reason: routeScore.reason || 'ROUTE_SCORE_DEGRADED',
      decidedAt: now
    };
  }

  return {
    route,
    readiness: 'ready',
    eligible: true,
    reason: 'EXECUTION_READY',
    decidedAt: now
  };
}

function run(payload) {
  if (!isObject(payload) || !isObject(payload.input) || !isObject(payload.state)) {
    return {
      ok: false,
      skill: 'execution-readiness-guard',
      error: 'INVALID_PAYLOAD'
    };
  }

  const route = payload.input.route;
  const now = typeof payload.now === 'string' ? payload.now : new Date().toISOString();

  if (typeof route !== 'string' || !route.trim()) {
    return {
      ok: false,
      skill: 'execution-readiness-guard',
      error: 'MISSING_ROUTE'
    };
  }

  const decision = buildDecision(route, payload.state, now);

  return {
    ok: true,
    skill: 'execution-readiness-guard',
    decision,
    stateUpdates: {
      executionReadinessByRoute: {
        [route]: decision
      },
      lastExecutionReadinessDecision: decision
    },
    auditEntry: {
      skill: 'execution-readiness-guard',
      route,
      decision: decision.readiness,
      reason: decision.reason,
      recordedAt: now
    }
  };
}

module.exports = {
  run
};
