import { CircuitBreaker } from '@/lib/ai/circuit-breaker';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CircuitBreaker', () => {
  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------
  describe('state transitions', () => {
    it('starts in closed state', () => {
      const cb = new CircuitBreaker({ name: 'test' });
      expect(cb.getState()).toBe('closed');
    });

    it('stays closed after failures below threshold', () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, name: 'test' });
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('closed');
    });

    it('trips to open after reaching failure threshold (default 3)', () => {
      const cb = new CircuitBreaker({ name: 'test' });
      cb.recordFailure();
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('open');
    });

    it('transitions from open to half_open after cooldown elapsed', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 50, name: 'test' });
      cb.recordFailure(); // trips to open
      expect(cb.getState()).toBe('open');

      await delay(60);

      expect(cb.getState()).toBe('half_open');
    });

    it('resets to closed after successful call in half_open', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 50, name: 'test' });
      cb.recordFailure();
      expect(cb.getState()).toBe('open');

      await delay(60);
      expect(cb.getState()).toBe('half_open');

      cb.recordSuccess();
      expect(cb.getState()).toBe('closed');
    });

    it('returns to open if probe call fails in half_open', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 50, name: 'test' });
      cb.recordFailure();
      expect(cb.getState()).toBe('open');

      await delay(60);
      expect(cb.getState()).toBe('half_open');

      cb.recordFailure();
      expect(cb.getState()).toBe('open');
    });
  });

  // ---------------------------------------------------------------------------
  // canExecute
  // ---------------------------------------------------------------------------
  describe('canExecute', () => {
    it('returns true when closed', () => {
      const cb = new CircuitBreaker({ name: 'test' });
      expect(cb.canExecute()).toBe(true);
    });

    it('returns false when open (cooldown not elapsed)', () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000, name: 'test' });
      cb.recordFailure();
      expect(cb.canExecute()).toBe(false);
    });

    it('returns true when half_open', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 50, name: 'test' });
      cb.recordFailure();
      expect(cb.canExecute()).toBe(false);

      await delay(60);

      expect(cb.canExecute()).toBe(true);
      // Verify it actually transitioned to half_open (not closed)
      expect(cb.getState()).toBe('half_open');
    });
  });

  // ---------------------------------------------------------------------------
  // execute()
  // ---------------------------------------------------------------------------
  describe('execute()', () => {
    it('passes through successful result', async () => {
      const cb = new CircuitBreaker({ name: 'test' });
      const result = await cb.execute(() => Promise.resolve(42));
      expect(result).toBe(42);
    });

    it('throws when circuit is open', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, cooldownMs: 60_000, name: 'test-svc' });
      cb.recordFailure();

      await expect(cb.execute(() => Promise.resolve('nope'))).rejects.toThrow(
        /Circuit breaker "test-svc" is open/
      );
    });

    it('records failure and rethrows on fn rejection', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 5, name: 'test' });
      const error = new Error('upstream down');

      await expect(cb.execute(() => Promise.reject(error))).rejects.toThrow('upstream down');
      // After one failure the breaker should still be closed (threshold is 5)
      expect(cb.getState()).toBe('closed');
    });

    it('records success on fn success', async () => {
      const cb = new CircuitBreaker({ failureThreshold: 3, name: 'test' });
      // Push to the brink (2 failures, threshold is 3)
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('closed');

      // A successful execute should reset the failure count
      await cb.execute(() => Promise.resolve('ok'));
      expect(cb.getState()).toBe('closed');

      // Now two more failures should NOT trip the breaker (counter was reset)
      cb.recordFailure();
      cb.recordFailure();
      expect(cb.getState()).toBe('closed');
    });
  });

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------
  describe('configuration', () => {
    it('custom failureThreshold works', () => {
      const cb = new CircuitBreaker({ failureThreshold: 5, name: 'test' });

      for (let i = 0; i < 4; i++) {
        cb.recordFailure();
      }
      expect(cb.getState()).toBe('closed');

      cb.recordFailure(); // 5th failure
      expect(cb.getState()).toBe('open');
    });

    it('reset() manually resets state', () => {
      const cb = new CircuitBreaker({ failureThreshold: 1, name: 'test' });
      cb.recordFailure();
      expect(cb.getState()).toBe('open');

      cb.reset();
      expect(cb.getState()).toBe('closed');
      expect(cb.canExecute()).toBe(true);

      // Verify failure counter was also reset: one failure should trip again
      cb.recordFailure();
      expect(cb.getState()).toBe('open');
    });
  });
});
