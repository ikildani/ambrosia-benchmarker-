/**
 * Fetch wrapper with AbortController timeout and exponential backoff retry.
 * Retries on transient HTTP errors (429, 502, 503, 504) and network failures.
 */

const TRANSIENT_STATUS_CODES = [429, 502, 503, 504];

interface FetchWithTimeoutOptions extends RequestInit {
  /** Request timeout in milliseconds. Default: 15000 (15s). */
  timeoutMs?: number;
  /** Number of retries on transient failures. Default: 2. */
  retries?: number;
  /** Base delay between retries in ms (doubles each attempt). Default: 1000. */
  retryDelayMs?: number;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 15_000,
    retries = 2,
    retryDelayMs = 1_000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (TRANSIENT_STATUS_CODES.includes(response.status) && attempt < retries) {
        const delay = retryDelayMs * Math.pow(2, attempt) + Math.random() * retryDelayMs;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timer);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        const delay = retryDelayMs * Math.pow(2, attempt) + Math.random() * retryDelayMs;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
    }
  }

  throw lastError ?? new Error(`fetchWithTimeout failed after ${retries + 1} attempts`);
}
