// Runs before `vite build`. On Vercel (which sets VERCEL=1 during builds) any
// problem stops the deployment; elsewhere it's printed as a note. It checks that
// the /api route points at a real HTTPS API and adds the proxy secret from the
// ORIGIN_SECRET project variable, and that the secret can't reach the browser.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SECRET_HEADER = 'x-origin-secret';
const SECRET_ARGS = new Set(['$ORIGIN_SECRET', '${ORIGIN_SECRET}']);

/** Problems with `vercel` (parsed vercel.json) for a build with environment `env`. */
export function checkDeployConfig(vercel, env = {}) {
  const problems = [];
  const routes = vercel.routes ?? [];
  const api = routes.find((route) => (route.src ?? route.source) === '/api/(.*)');

  if (!api) {
    problems.push('vercel.json has no "/api/(.*)" route');
  } else {
    const dest = api.dest ?? api.destination ?? '';
    let target;
    try {
      target = new URL(dest.replace('$1', ''));
    } catch {
      problems.push('the /api route destination is not a URL');
    }
    if (target) {
      if (target.hostname.startsWith('replace-with')) {
        problems.push('the /api route still points at the placeholder Render URL');
      }
      if (target.protocol !== 'https:') problems.push('the /api route must use https');
      if (!dest.endsWith('/api/$1')) {
        problems.push('the /api route must keep the /api/ prefix (…/api/$1)');
      }
    }
    const transform = (api.transforms ?? []).find(
      (t) => t.type === 'request.headers' && t.target?.key === SECRET_HEADER,
    );
    if (
      !transform ||
      transform.op !== 'set' ||
      !SECRET_ARGS.has(transform.args) ||
      !transform.env?.includes('ORIGIN_SECRET')
    ) {
      problems.push(
        `the /api route must set the ${SECRET_HEADER} request header from $ORIGIN_SECRET (op "set", env ["ORIGIN_SECRET"])`,
      );
    }
  }

  // Nothing else may proxy /api without the secret.
  for (const rule of vercel.rewrites ?? []) {
    if (rule.source.startsWith('/api') || rule.source === '/(.*)' || rule.source === '/:path*') {
      problems.push(
        `the rewrite "${rule.source}" can match /api; exclude it (e.g. /:path((?!api/).*))`,
      );
    }
  }

  const text = JSON.stringify(vercel);
  if (env.ORIGIN_SECRET && text.includes(env.ORIGIN_SECRET)) {
    problems.push('vercel.json contains the secret itself; reference $ORIGIN_SECRET instead');
  }
  for (const name of Object.keys(env)) {
    if (name.startsWith('VITE_') && /SECRET|ORIGIN_SECRET/.test(name)) {
      problems.push(`${name} would be built into the browser bundle; remove it`);
    }
  }
  if (env.VERCEL && (!env.ORIGIN_SECRET || env.ORIGIN_SECRET.length < 32)) {
    problems.push(
      'the ORIGIN_SECRET project variable must be set (32+ characters, the same value as on Render); without it the /api route sends the literal text "$ORIGIN_SECRET" and the API refuses every request',
    );
  }
  return problems;
}

function main() {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const problems = checkDeployConfig(vercel, process.env);
  if (problems.length === 0) return;
  const message = `client/vercel.json: ${problems.join('; ')}. See docs/deployment.md.`;
  if (process.env.VERCEL) {
    console.error(message);
    process.exit(1);
  }
  console.warn(`Note (not a Vercel build, continuing): ${message}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
