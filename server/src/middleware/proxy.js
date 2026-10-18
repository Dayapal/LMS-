import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export const ORIGIN_SECRET_HEADER = 'x-origin-secret';

// Render's health checks call the service directly, without the proxy's header.
const OPEN_PATHS = new Set(['/api/v1/health']);

// Hashing both sides gives equal-length buffers, so the comparison is constant-time
// whatever the caller sends.
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();
const matchesAny = (given, secrets) => {
  const candidate = digest(given);
  // Every secret is compared, so the time doesn't reveal which one matched.
  return secrets.reduce(
    (ok, secret) => crypto.timingSafeEqual(candidate, digest(secret)) || ok,
    false,
  );
};

/**
 * Only traffic that came through the Vercel proxy reaches the API. The proxy's
 * `/api` route sets `x-origin-secret` from a Vercel environment variable at the
 * edge (client/vercel.json), replacing any value a visitor sent; the browser
 * never sees it. Requests to the Render URL directly are refused here, before
 * CORS, body parsing or uploads run, so they can't be used to choose the IP the
 * rate limiter sees (they'd skip one proxy hop) or to reach the API at all.
 *
 * Off when no secret is configured, which production refuses (config/env.js).
 */
export function requireOriginSecret(req, res, next) {
  const secrets = config.originSecrets;
  if (secrets.length === 0 || OPEN_PATHS.has(req.path)) return next();
  const given = req.get(ORIGIN_SECRET_HEADER);
  if (!given || !matchesAny(given, secrets)) {
    res.set('Cache-Control', 'no-store');
    // Don't keep the connection open for a body that will never be read.
    res.set('Connection', 'close');
    throw ApiError.forbidden('Requests must go through the application URL');
  }
  next();
}

/**
 * The address Express would use as `req.ip` for each possible TRUST_PROXY
 * value: the socket address, then X-Forwarded-For from right to left.
 */
export function ipByTrustProxy(req) {
  const forwarded = (req.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const chain = [req.socket.remoteAddress, ...forwarded.reverse()];
  return {
    forwardedFor: forwarded.length,
    candidates: chain.map((_, hops) => ({ trustProxy: hops, ip: chain[hops] })),
  };
}

/**
 * GET /health/proxy, only while PROXY_DIAGNOSTICS=true: shows the caller which
 * TRUST_PROXY value turns their own public IP into `req.ip`. Used once after
 * deploying (docs/deployment.md), then switched off again. Behind the origin
 * check, so it measures the real path through Vercel.
 */
export function proxyDiagnostics(req, res) {
  const { forwardedFor, candidates } = ipByTrustProxy(req);
  res.json({
    success: true,
    data: { trustProxy: config.trustProxy, ip: req.ip, forwardedFor, candidates },
  });
}
