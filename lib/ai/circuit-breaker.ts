/**
 * Simple circuit breaker for AI API calls.
 * Prevents hammering a failing service — trips open after consecutive failures,
 * then allows a single probe after a cooldown period.
 *
 * States:
 *   CLOSED  → normal operation, calls pass through
 *   OPEN    → calls rejected immediately (service is down)
 *   HALF_OPEN → single probe call allowed; success resets, failure reopens
 */

type CircuitState = 'closed' | 'open' | 'half_open';

interface CircuitBreakerOptions {
  /** Number of consecutive failures before tripping open. Default: 3. */
  failureThreshold?: number;
  /** Cooldown in ms before allowing a probe call. Default: 60_000 (1 min). */
  cooldownMs?: number;
  /** Name for logging. */
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.cooldownMs = options.cooldownMs ?? 60_000;
    this.name = options.name ?? 'unnamed';
  }

  /** Current circuit state. */
  getState(): CircuitState {
    if (this.state === 'open') {
      // Check if cooldown has elapsed → transition to half_open
      if (Date.now() - this.lastFailureTime >= this.cooldownMs) {
        this.state = 'half_open';
      }
    }
    return this.state;
  }

  /** Whether a call is currently allowed. */
  canExecute(): boolean {
    const state = this.getState();
    return state === 'closed' || state === 'half_open';
  }

  /** Record a successful call — resets the circuit to closed. */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'closed';
  }

  /** Record a failed call — may trip the circuit open. */
  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  /** Manual reset (e.g., for testing or admin override). */
  reset(): void {
    this.state = 'closed';
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }

  /** Execute a function through the circuit breaker. */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new Error(
        `Circuit breaker "${this.name}" is open — AI service temporarily unavailable. Try again in ${Math.ceil(
          (this.cooldownMs - (Date.now() - this.lastFailureTime)) / 1000
        )}s.`
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}
