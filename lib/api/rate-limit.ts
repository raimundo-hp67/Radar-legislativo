import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * In-memory fixed-window rate limiter.
 *
 * Limitation: state lives in the process, so on serverless platforms each
 * instance keeps its own counters. That still throttles bursts against a
 * single instance (the common abuse pattern), but for strict global limits
 * across many instances you'd need a shared store (e.g. Redis).
 */

type WindowEntry = {
  count: number
  resetAt: number
};

const windows = new Map<string, WindowEntry>();

// Evict expired windows periodically so the map doesn't grow unbounded.
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitOptions = {
  /** Max requests allowed per window. */
  limit: number
  /** Window size in milliseconds. */
  windowMs: number
};

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  /** Seconds until the window resets. */
  retryAfter: number
};

export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const entry = windows.get(key);
  if (!entry || entry.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + options.windowMs });
    return { allowed: true, remaining: options.limit - 1, retryAfter: Math.ceil(options.windowMs / 1000) };
  }

  entry.count += 1;
  const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
  if (entry.count > options.limit) {
    return { allowed: false, remaining: 0, retryAfter };
  }
  return { allowed: true, remaining: options.limit - entry.count, retryAfter };
}

/**
 * Best-effort client IP. x-forwarded-for is attacker-controlled unless a
 * trusted proxy rewrites it, so it is only honored on Vercel (which does)
 * or when the operator sets TRUST_PROXY=1 behind their own proxy. Otherwise
 * the socket address is used, so spoofed headers can't reset IP rate limits.
 */
export function getClientIp(req: NextApiRequest): string {
  const trustProxy = Boolean(process.env.VERCEL) || process.env.TRUST_PROXY === '1';
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/**
 * Apply a rate limit inside an API handler. Returns `true` when the request
 * was rejected (a 429 response has already been sent) — callers should
 * `return` immediately in that case.
 */
export function applyRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  key: string,
  options: RateLimitOptions,
): boolean {
  const result = rateLimit(key, options);
  res.setHeader('X-RateLimit-Limit', String(options.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({
      error: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.',
      retryAfter: result.retryAfter,
    });
    return true;
  }
  return false;
}
