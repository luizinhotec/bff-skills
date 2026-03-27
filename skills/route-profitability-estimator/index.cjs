'use strict';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePayload(payload) {
  if (!isObject(payload)) {
    return null;
  }

  if (isObject(payload.input)) {
    return {
      route: payload.input.route,
      amountIn: payload.input.amountIn,
      state: payload.state,
      now: payload.now
    };
  }

  return {
    route: payload.route,
    amountIn: payload.amountIn,
    state: payload.state,
    now: payload.now
  };
}

function buildStateUpdate(route, profitable, netOut, evaluatedAt) {
  return {
    routeProfitabilityByRoute: {
      [route]: {
        profitable,
        netOut,
        evaluatedAt
      }
    }
  };
}

function run(payload) {
  const normalized = normalizePayload(payload);
  if (!normalized || !isObject(normalized.state)) {
    return {
      ok: false,
      skill: 'route-profitability-estimator',
      error: 'INVALID_PAYLOAD'
    };
  }

  const route = normalized.route;
  const amountIn = normalized.amountIn;
  const now = typeof normalized.now === 'string'
    ? normalized.now
    : new Date().toISOString();

  if (typeof route !== 'string' || !route.trim()) {
    return {
      ok: false,
      skill: 'route-profitability-estimator',
      error: 'MISSING_ROUTE'
    };
  }

  if (!Number.isFinite(amountIn) || amountIn <= 0) {
    return {
      ok: false,
      skill: 'route-profitability-estimator',
      error: 'INVALID_AMOUNT_IN'
    };
  }

  const quote = normalized.state.marketQuotesByRoute?.[route] ?? null;
  const expectedOut = quote?.expectedOut;

  if (!Number.isFinite(expectedOut)) {
    return {
      ok: true,
      skill: 'route-profitability-estimator',
      route,
      profitable: null,
      netOut: null,
      costs: {
        fee: 0,
        slippage: 0
      },
      reason: 'UNKNOWN',
      stateUpdates: buildStateUpdate(route, null, null, now),
      auditEntry: {
        skill: 'route-profitability-estimator',
        route,
        profitable: null,
        netOut: null,
        reason: 'UNKNOWN',
        recordedAt: now
      }
    };
  }

  const feeBps = Number.isFinite(quote?.feeBps) ? quote.feeBps : 0;
  const slippageBps = Number.isFinite(quote?.slippageBps) ? quote.slippageBps : 0;
  const fee = (amountIn * feeBps) / 10000;
  const slippage = (amountIn * slippageBps) / 10000;
  const netOut = expectedOut - fee - slippage;

  let profitable;
  let reason;

  if (netOut <= 0) {
    profitable = false;
    reason = 'UNPROFITABLE';
  } else if (netOut < amountIn) {
    profitable = false;
    reason = 'UNPROFITABLE_AFTER_COSTS';
  } else {
    profitable = true;
    reason = 'PROFITABLE';
  }

  return {
    ok: true,
    skill: 'route-profitability-estimator',
    route,
    profitable,
    netOut,
    costs: {
      fee,
      slippage
    },
    reason,
    stateUpdates: buildStateUpdate(route, profitable, netOut, now),
    auditEntry: {
      skill: 'route-profitability-estimator',
      route,
      profitable,
      netOut,
      reason,
      recordedAt: now
    }
  };
}

module.exports = {
  run
};
