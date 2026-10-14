import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  authHttp,
  getAccessToken,
  http,
  refreshSession,
  setAccessToken,
  setSessionExpiredHandler,
} from './http.js';

const respond = (config, status, data) => {
  const response = { status, data, headers: {}, config, statusText: String(status) };
  if (status >= 400) {
    const error = new Error(`Request failed with status ${status}`);
    error.config = config;
    error.response = response;
    error.isAxiosError = true;
    return Promise.reject(error);
  }
  return Promise.resolve(response);
};

const session = (token) => ({ success: true, data: { accessToken: token, user: { id: 'u1' } } });

let refreshCalls;

beforeEach(() => {
  refreshCalls = 0;
  setAccessToken('expired-token');
  setSessionExpiredHandler(() => {});
});

describe('http client', () => {
  it('attaches the in-memory access token as a bearer header', async () => {
    setAccessToken('abc');
    http.defaults.adapter = (config) =>
      respond(config, 200, { auth: config.headers.Authorization });
    const res = await http.get('/x');
    expect(res.data.auth).toBe('Bearer abc');
  });

  it('refreshes once on 401 and retries the original request with the new token', async () => {
    authHttp.defaults.adapter = (config) => {
      refreshCalls += 1;
      return respond(config, 200, session('fresh-token'));
    };
    http.defaults.adapter = (config) =>
      config.headers.Authorization === 'Bearer fresh-token'
        ? respond(config, 200, { ok: true })
        : respond(config, 401, { error: { code: 'UNAUTHENTICATED' } });

    const res = await http.get('/courses');
    expect(res.data).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('shares one refresh between concurrent 401s', async () => {
    authHttp.defaults.adapter = (config) => {
      refreshCalls += 1;
      return new Promise((resolve) => setTimeout(resolve, 20)).then(() =>
        respond(config, 200, session('fresh-token')),
      );
    };
    http.defaults.adapter = (config) =>
      config.headers.Authorization === 'Bearer fresh-token'
        ? respond(config, 200, { url: config.url })
        : respond(config, 401, {});

    const results = await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')]);
    expect(results.map((r) => r.data.url)).toEqual(['/a', '/b', '/c']);
    expect(refreshCalls).toBe(1);
  });

  it('signals session expiry when the refresh fails and does not loop', async () => {
    const expired = vi.fn();
    setSessionExpiredHandler(expired);
    authHttp.defaults.adapter = (config) => {
      refreshCalls += 1;
      return respond(config, 401, {});
    };
    let calls = 0;
    http.defaults.adapter = (config) => {
      calls += 1;
      return respond(config, 401, {});
    };

    await expect(http.get('/x')).rejects.toMatchObject({ response: { status: 401 } });
    expect(expired).toHaveBeenCalledOnce();
    expect(refreshCalls).toBe(1);
    expect(calls).toBe(1);
    expect(getAccessToken()).toBeNull();
  });

  it('does not refresh for non-401 errors', async () => {
    authHttp.defaults.adapter = (config) => {
      refreshCalls += 1;
      return respond(config, 200, session('t'));
    };
    http.defaults.adapter = (config) => respond(config, 403, {});
    await expect(http.get('/x')).rejects.toMatchObject({ response: { status: 403 } });
    expect(refreshCalls).toBe(0);
  });

  it('refreshSession resolves the session payload', async () => {
    authHttp.defaults.adapter = (config) => respond(config, 200, session('t2'));
    await expect(refreshSession()).resolves.toMatchObject({ accessToken: 't2' });
  });
});
