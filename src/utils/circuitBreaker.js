/**
 * Circuit Breaker — inspired by Resilience4j
 *
 * States:
 *   CLOSED    — normal operation, requests pass through
 *   OPEN      — too many failures, requests blocked immediately
 *   HALF_OPEN — cooldown elapsed, one probe request allowed through
 *
 * Config:
 *   failureThreshold  — consecutive failures before tripping OPEN  (default 3)
 *   successThreshold  — successes in HALF_OPEN before returning to CLOSED (default 1)
 *   timeout           — ms to stay OPEN before moving to HALF_OPEN (default 30s)
 */

const STATE = { CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' };

export class CircuitBreaker {
  constructor({ failureThreshold = 3, successThreshold = 1, timeout = 30_000 } = {}) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout          = timeout;
    this.state            = STATE.CLOSED;
    this.failureCount     = 0;
    this.successCount     = 0;
    this.nextAttempt      = 0;
  }

  get status() { return this.state; }
  get isOpen()  { return this.state === STATE.OPEN && Date.now() < this.nextAttempt; }

  /** Wrap any async fn with circuit-breaker protection */
  async call(fn) {
    if (this.state === STATE.OPEN) {
      if (Date.now() < this.nextAttempt) {
        const retryIn = Math.ceil((this.nextAttempt - Date.now()) / 1000);
        throw new CircuitOpenError(`Circuit OPEN – retry in ${retryIn}s`);
      }
      // Cooldown elapsed → probe
      this.state = STATE.HALF_OPEN;
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      if (err instanceof CircuitOpenError) throw err;
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this.failureCount = 0;
    if (this.state === STATE.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state        = STATE.CLOSED;
        this.successCount = 0;
      }
    }
  }

  _onFailure() {
    this.successCount = 0;
    this.failureCount++;
    if (this.state === STATE.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state       = STATE.OPEN;
      this.nextAttempt = Date.now() + this.timeout;
      this.failureCount = 0;
    }
  }
}

export class CircuitOpenError extends Error {
  constructor(msg) { super(msg); this.name = 'CircuitOpenError'; }
}

// Shared singleton — one breaker for all API calls in this tab
export const apiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  successThreshold: 1,
  timeout: 30_000,
});
