import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { checkDeployConfig } from './check-deploy-config.js';
import { filesContainingSecrets } from './check-build-secrets.js';

const SECRET = 'example-origin-secret-for-tests-0123456789abcdef';
// A path, not a URL: jsdom (the client test environment) replaces the global URL.
const vercelJson = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'vercel.json');
const committed = JSON.parse(readFileSync(vercelJson, 'utf8'));

/** vercel.json as it should be after step 4 of the deployment guide. */
const deployed = () => {
  const copy = structuredClone(committed);
  copy.routes[0].dest = 'https://training-lms-api.onrender.com/api/$1';
  return copy;
};

describe('check-deploy-config', () => {
  it('accepts the configured project on Vercel', () => {
    expect(checkDeployConfig(deployed(), { VERCEL: '1', ORIGIN_SECRET: SECRET })).toEqual([]);
  });

  it('reports only the placeholder URL for the committed file (a note outside Vercel)', () => {
    expect(checkDeployConfig(committed, {})).toEqual([
      'the /api route still points at the placeholder Render URL',
    ]);
  });

  it('stops a Vercel build without the ORIGIN_SECRET project variable', () => {
    for (const value of [undefined, '', 'too-short']) {
      const problems = checkDeployConfig(deployed(), { VERCEL: '1', ORIGIN_SECRET: value });
      expect(problems.join()).toContain('the ORIGIN_SECRET project variable must be set');
    }
  });

  it('requires the /api route to set the header from the variable', () => {
    const variants = [
      (c) => delete c.routes[0].transforms,
      (c) => (c.routes[0].transforms[0].op = 'append'),
      (c) => (c.routes[0].transforms[0].args = SECRET),
      (c) => (c.routes[0].transforms[0].env = []),
      (c) => (c.routes[0].transforms[0].target.key = 'x-secret'),
    ];
    for (const change of variants) {
      const config = deployed();
      change(config);
      expect(checkDeployConfig(config, { ORIGIN_SECRET: SECRET }).join()).toContain(
        'must set the x-origin-secret request header',
      );
    }
  });

  it('refuses another way to /api, http, a literal secret or a VITE_ secret variable', () => {
    const catchAll = deployed();
    catchAll.rewrites = [{ source: '/(.*)', destination: '/index.html' }];
    expect(checkDeployConfig(catchAll).join()).toContain('can match /api');

    const apiRewrite = deployed();
    apiRewrite.rewrites.push({
      source: '/api/:path*',
      destination: 'https://x.onrender.com/api/:path*',
    });
    expect(checkDeployConfig(apiRewrite).join()).toContain('can match /api');

    const plain = deployed();
    plain.routes[0].dest = 'http://training-lms-api.onrender.com/api/$1';
    expect(checkDeployConfig(plain).join()).toContain('must use https');

    const literal = deployed();
    literal.routes[0].transforms[0].args = SECRET;
    expect(checkDeployConfig(literal, { ORIGIN_SECRET: SECRET }).join()).toContain(
      'contains the secret itself',
    );

    expect(checkDeployConfig(deployed(), { VITE_ORIGIN_SECRET: SECRET }).join()).toContain(
      'VITE_ORIGIN_SECRET would be built into the browser bundle',
    );
  });
});

describe('check-build-secrets', () => {
  let dir;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('finds the secret in any built file, and nothing when it is absent', () => {
    dir = mkdtempSync(path.join(os.tmpdir(), 'lms-build-'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'index.html'), '<html></html>');
    writeFileSync(path.join(dir, 'assets', 'index.js'), 'const api = "/api/v1";');
    expect(filesContainingSecrets(dir, [SECRET])).toEqual([]);

    writeFileSync(
      path.join(dir, 'assets', 'leak.js'),
      `headers: { "x-origin-secret": "${SECRET}" }`,
    );
    expect(filesContainingSecrets(dir, [undefined, SECRET])).toEqual(['assets/leak.js']);
    expect(filesContainingSecrets(dir, [undefined, ''])).toEqual([]);
  });
});
