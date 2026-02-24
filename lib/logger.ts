/**
 * Structured JSON logger with correlation IDs and timing.
 * Outputs consistent JSON to stdout/stderr for observability.
 *
 * Usage:
 *   const log = createLogger('deal-memo');
 *   log.info('Generating memo', { model: 'sonnet', attempt: 1 });
 *   log.error('Generation failed', { error: err.message, durationMs: 5200 });
 *   log.warn('Slow AI call', { durationMs: 12000 });
 */

import * as Sentry from '@sentry/nextjs';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  context: string;
  message: string;
  requestId?: string;
  timestamp: string;
  durationMs?: number;
  [key: string]: unknown;
}

interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  /** Start a timer; returns a function that stops it and returns elapsed ms. */
  startTimer(): () => number;
}

function formatEntry(level: LogLevel, context: string, message: string, requestId?: string, data?: Record<string, unknown>): LogEntry {
  return {
    level,
    context,
    message,
    requestId,
    timestamp: new Date().toISOString(),
    ...data,
  };
}

/**
 * Create a structured logger scoped to a context (e.g., route name or module).
 * Optionally attach a requestId for correlation across log lines.
 */
export function createLogger(context: string, requestId?: string): Logger {
  const emit = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
    const entry = formatEntry(level, context, message, requestId, data);

    switch (level) {
      case 'debug':
        // Only log debug in development
        if (process.env.NODE_ENV === 'development') {
          console.debug(JSON.stringify(entry));
        }
        break;
      case 'info':
        console.log(JSON.stringify(entry));
        break;
      case 'warn':
        console.warn(JSON.stringify(entry));
        // Also send warnings to Sentry for visibility
        Sentry.captureMessage(`[${context}] ${message}`, {
          level: 'warning',
          tags: { context },
          extra: { ...data, requestId },
        });
        break;
      case 'error':
        console.error(JSON.stringify(entry));
        // Errors already go to Sentry via captureApiError — avoid double-reporting
        break;
    }
  };

  return {
    debug: (message, data) => emit('debug', message, data),
    info: (message, data) => emit('info', message, data),
    warn: (message, data) => emit('warn', message, data),
    error: (message, data) => emit('error', message, data),
    startTimer() {
      const start = Date.now();
      return () => Date.now() - start;
    },
  };
}

/**
 * Wrap an API route handler with timing + requestId.
 * Logs request start, completion with durationMs, and errors.
 */
export function withRequestLogging(
  context: string,
  handler: (request: Request, log: Logger, requestId: string) => Promise<Response>
) {
  return async (request: Request): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const log = createLogger(context, requestId);
    const elapsed = log.startTimer();

    try {
      const response = await handler(request, log, requestId);
      const durationMs = elapsed();

      if (durationMs > 5000) {
        log.warn('Slow request', { durationMs, status: response.status });
      } else {
        log.info('Request completed', { durationMs, status: response.status });
      }

      return response;
    } catch (error) {
      const durationMs = elapsed();
      log.error('Request failed', {
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}
