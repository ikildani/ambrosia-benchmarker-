import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const errorRate = new Rate('errors');
const healthDuration = new Trend('health_duration', true);
const financialDuration = new Trend('financial_duration', true);

// ---------------------------------------------------------------------------
// Configurable base URL  (k6 run -e BASE_URL=https://calculator.ambrosiaventures.co)
// ---------------------------------------------------------------------------
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Scenario definitions — pick one with:  k6 run --env SCENARIO=load k6-smoke.js
// Or run the default "smoke" scenario.
// ---------------------------------------------------------------------------
const SCENARIO = __ENV.SCENARIO || 'smoke';

const scenarios = {
  // 1 VU, 30 s — quick sanity check
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    exec: 'smokeTest',
  },
  // Ramp 1 -> 50 -> 0 over 3 min — normal load
  load: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 50 },
      { duration: '30s', target: 50 },
      { duration: '1m', target: 0 },
    ],
    exec: 'loadTest',
  },
  // Ramp to 100 VUs — test rate-limiter behaviour (expect 429s)
  stress: {
    executor: 'ramping-vus',
    startVUs: 1,
    stages: [
      { duration: '30s', target: 50 },
      { duration: '1m', target: 100 },
      { duration: '1m', target: 100 },
      { duration: '30s', target: 0 },
    ],
    exec: 'stressTest',
  },
};

// Only activate the chosen scenario
export const options = {
  scenarios: {
    [SCENARIO]: scenarios[SCENARIO],
  },
  thresholds: buildThresholds(),
};

function buildThresholds() {
  switch (SCENARIO) {
    case 'smoke':
      return {
        http_req_duration: ['p(95)<500'],   // p95 under 500 ms
        errors: ['rate<0.01'],              // error rate under 1%
      };
    case 'load':
      return {
        http_req_duration: ['p(95)<500'],
        errors: ['rate<0.05'],              // error rate under 5%
      };
    case 'stress':
      return {
        // Stress test: we only care that the server stays up.
        // 429s are expected and counted separately, not as errors.
        http_req_duration: ['p(95)<2000'],
      };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const HEADERS = { 'Content-Type': 'application/json' };

function hitHealth() {
  const res = http.get(`${BASE_URL}/api/health`);
  healthDuration.add(res.timings.duration);

  const ok = check(res, {
    'health: status is 200 or 503': (r) => r.status === 200 || r.status === 503,
    'health: has status field': (r) => {
      try { return JSON.parse(r.body).status !== undefined; }
      catch { return false; }
    },
  });
  errorRate.add(!ok);
  return res;
}

function hitFinancial() {
  const params = 'therapeuticArea=oncology&indication=lung_nsclc&modality=adc';
  const res = http.get(`${BASE_URL}/api/financial?${params}`);
  financialDuration.add(res.timings.duration);

  const ok = check(res, {
    'financial: status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
  errorRate.add(!ok);
  return res;
}

function hitDeals() {
  const res = http.get(`${BASE_URL}/api/deals?therapeutic_area=oncology&limit=10`);
  const ok = check(res, {
    'deals: status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
  errorRate.add(!ok);
  return res;
}

// ---------------------------------------------------------------------------
// Scenario entry points
// ---------------------------------------------------------------------------

/** Smoke: single VU hitting /api/health repeatedly */
export function smokeTest() {
  group('smoke - health', () => {
    hitHealth();
  });
  sleep(1);
}

/** Load: hit health + financial endpoints under moderate concurrency */
export function loadTest() {
  group('load - health', () => {
    hitHealth();
  });

  group('load - financial', () => {
    hitFinancial();
  });

  group('load - deals', () => {
    hitDeals();
  });

  sleep(0.5 + Math.random() * 1); // 0.5-1.5 s between iterations
}

/** Stress: hammer endpoints to trigger rate limiting (429s expected) */
export function stressTest() {
  group('stress - health', () => {
    hitHealth();
  });

  group('stress - financial', () => {
    hitFinancial();
  });

  group('stress - deals', () => {
    hitDeals();
  });

  // Minimal pause to maximize request rate
  sleep(0.1 + Math.random() * 0.3);
}

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  // Print a human-readable summary to stdout (default k6 behaviour).
  // You could also export JSON here for CI integration:
  //   return { 'load-tests/results.json': JSON.stringify(data) };
  return {};
}
