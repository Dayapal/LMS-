import axios from 'axios';

export const API_BASE_URL = '/api/v1';

// The access token lives only in memory; the refresh token is an httpOnly cookie.
let accessToken = null;
let onSessionExpired = () => {};

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

/** Client for the cookie-based auth endpoints. Never retried by the interceptor. */
export const authHttp = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

/** Client for every other API call. */
export const http = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

let refreshInFlight = null;

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share
 * one request so the rotating refresh token is only presented once.
 */
export function refreshSession() {
  refreshInFlight ??= authHttp
    .post('/auth/refresh')
    .then((res) => {
      setAccessToken(res.data.data.accessToken);
      return res.data.data;
    })
    .catch((error) => {
      setAccessToken(null);
      throw error;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || !original || original._retried) throw error;

    original._retried = true;
    try {
      await refreshSession();
    } catch {
      onSessionExpired();
      throw error;
    }
    return http(original);
  },
);
