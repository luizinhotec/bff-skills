declare const Bun: {
  argv: string[];
  stdin: {
    text: () => Promise<string>;
  };
};

type RouteOperator = {
  decision?: string;
  reason?: string;
  protocol?: string;
};

type RouteHealth = {
  status?: string;
  reason?: string;
};

type RouteScore = {
  status?: string;
  reason?: string;
  score?: number;
};

type State = {
  routeOperatorByRoute?: Record<string, RouteOperator | undefined>;
  routeHealthByRoute?: Record<string, RouteHealth | undefined>;
  protocolHealthByProtocol?: Record<string, RouteHealth | undefined>;
  routeScoreByRoute?: Record<string, RouteScore | undefined>;
};

type Input = {
  route?: string;
  state?: State;
};

type Readiness = 'ready' | 'degraded' | 'blocked' | 'unknown';

type Output =
  | {
      ok: true;
      skill: 'execution-readiness-guard';
      route: string;
      readiness: Readiness;
      eligible: boolean;
      reason: string;
    }
  | {
      ok: false;
      skill: 'execution-readiness-guard';
      error: 'INVALID_INPUT' | 'MISSING_ROUTE' | 'INVALID_STATE';
    };

type DoctorOutput = {
  ok: true;
  skill: 'execution-readiness-guard';
  command: 'doctor';
  status: 'ready';
  checks: {
    runtime: 'bun';
    deterministic: true;
    writeActions: false;
    inputMode: 'stdin-json';
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function buildUnknown(route: string, reason: string): Output {
  return {
    ok: true,
    skill: 'execution-readiness-guard',
    route,
    readiness: 'unknown',
    eligible: false,
    reason
  };
}

function buildDecision(state: State, route: string): Output {
  const routeOperator = state.routeOperatorByRoute?.[route] ?? null;
  const routeHealth = state.routeHealthByRoute?.[route] ?? null;
  const routeScore = state.routeScoreByRoute?.[route] ?? null;

  if (!routeOperator) {
    return buildUnknown(route, 'MISSING_ROUTE_OPERATOR');
  }

  if (!routeHealth) {
    return buildUnknown(route, 'MISSING_ROUTE_HEALTH');
  }

  if (!routeScore) {
    return buildUnknown(route, 'MISSING_ROUTE_SCORE');
  }

  const protocol = routeOperator.protocol ?? null;

  if (!protocol || protocol.trim() === '') {
    return buildUnknown(route, 'MISSING_PROTOCOL_REFERENCE');
  }

  const protocolHealth = state.protocolHealthByProtocol?.[protocol] ?? null;

  if (!protocolHealth) {
    return buildUnknown(route, 'MISSING_PROTOCOL_HEALTH');
  }

  if (routeOperator.decision === 'BLOCK') {
    return {
      ok: true,
      skill: 'execution-readiness-guard',
      route,
      readiness: 'blocked',
      eligible: false,
      reason: routeOperator.reason || 'ROUTE_OPERATOR_BLOCKED'
    };
  }

  if (routeHealth.status === 'blocked') {
    return {
      ok: true,
      skill: 'execution-readiness-guard',
      route,
      readiness: 'blocked',
      eligible: false,
      reason: routeHealth.reason || 'ROUTE_HEALTH_BLOCKED'
    };
  }

  if (protocolHealth.status === 'blocked') {
    return {
      ok: true,
      skill: 'execution-readiness-guard',
      route,
      readiness: 'blocked',
      eligible: false,
      reason: protocolHealth.reason || 'PROTOCOL_BLOCKED'
    };
  }

  if (routeScore.status === 'degraded') {
    return {
      ok: true,
      skill: 'execution-readiness-guard',
      route,
      readiness: 'degraded',
      eligible: false,
      reason: routeScore.reason || 'ROUTE_SCORE_DEGRADED'
    };
  }

  return {
    ok: true,
    skill: 'execution-readiness-guard',
    route,
    readiness: 'ready',
    eligible: true,
    reason: 'EXECUTION_READY'
  };
}

function buildError(error: Output['error']): Output {
  return {
    ok: false,
    skill: 'execution-readiness-guard',
    error
  };
}

function parseInput(raw: string): Input {
  if (!raw.trim()) {
    throw new Error('INVALID_INPUT');
  }

  const parsed = JSON.parse(raw) as unknown;

  if (!isObject(parsed)) {
    throw new Error('INVALID_INPUT');
  }

  return parsed as Input;
}

function run(input: Input): Output {
  if (typeof input.route !== 'string' || input.route.trim() === '') {
    return buildError('MISSING_ROUTE');
  }

  if (!isObject(input.state)) {
    return buildError('INVALID_STATE');
  }

  return buildDecision(input.state as State, input.route);
}

function doctor(): DoctorOutput {
  return {
    ok: true,
    skill: 'execution-readiness-guard',
    command: 'doctor',
    status: 'ready',
    checks: {
      runtime: 'bun',
      deterministic: true,
      writeActions: false,
      inputMode: 'stdin-json'
    }
  };
}

async function main(): Promise<void> {
  try {
    const command = Bun.argv[2] || 'run';

    if (command === 'doctor') {
      console.log(JSON.stringify(doctor()));
      return;
    }

    if (command !== 'run') {
      console.log(JSON.stringify(buildError('INVALID_INPUT')));
      process.exitCode = 1;
      return;
    }

    const raw = await Bun.stdin.text();
    const input = parseInput(raw);
    const result = run(input);
    console.log(JSON.stringify(result));

    if (!result.ok) {
      process.exitCode = 1;
    }
  } catch {
    console.log(JSON.stringify(buildError('INVALID_INPUT')));
    process.exitCode = 1;
  }
}

void main();
