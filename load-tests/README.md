# Load Tests

Performance and stress testing for the Ambrosia Benchmarker API using [k6](https://k6.io/).

## Install k6

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker (any platform)
docker pull grafana/k6
```

## Running Tests

All commands accept `-e BASE_URL=<url>` to change the target (default: `http://localhost:3000`).

### Smoke Test (quick sanity check)

1 virtual user for 30 seconds, hitting `/api/health` only.

```bash
k6 run -e SCENARIO=smoke load-tests/k6-smoke.js
```

Or use the npm script shortcut:

```bash
npm run test:load
```

### Load Test (moderate traffic)

Ramps from 1 to 50 virtual users over 3 minutes, hitting `/api/health`, `/api/financial`, and `/api/deals`.

```bash
k6 run -e SCENARIO=load load-tests/k6-smoke.js
```

### Stress Test (rate limiter validation)

Ramps to 100 virtual users with minimal pause between requests. Expect HTTP 429 responses from the rate limiter. This verifies the server stays up under pressure.

```bash
k6 run -e SCENARIO=stress load-tests/k6-smoke.js
```

## Running Against Staging / Production

```bash
# Staging (Vercel preview)
k6 run -e SCENARIO=load -e BASE_URL=https://your-preview-url.vercel.app load-tests/k6-smoke.js

# Production
k6 run -e SCENARIO=smoke -e BASE_URL=https://solidus.ambrosiaventures.co load-tests/k6-smoke.js
```

**Warning:** Only run `smoke` against production. Running `load` or `stress` against production will trigger rate limiting and may affect real users.

## Interpreting Results

k6 prints a summary table after each run. Key metrics to watch:

| Metric | What it means | Target |
|---|---|---|
| `http_req_duration` (p95) | 95th percentile response time | < 500 ms (smoke/load), < 2000 ms (stress) |
| `errors` | Percentage of failed checks | < 1% (smoke), < 5% (load) |
| `http_reqs` | Total requests sent | Higher is better for throughput |
| `http_req_failed` | Requests that returned non-2xx | Expected to be high in stress test (429s) |
| `health_duration` | Response time for /api/health | Should be fast (< 100 ms) |
| `financial_duration` | Response time for /api/financial | Slower due to DB queries |

### Threshold failures

If a threshold is breached, k6 exits with code 99. This makes it suitable for CI pipelines:

```bash
k6 run -e SCENARIO=smoke load-tests/k6-smoke.js || echo "Performance regression detected"
```

## Exporting Results

To save results as JSON for further analysis:

```bash
k6 run -e SCENARIO=load --out json=load-tests/results.json load-tests/k6-smoke.js
```
