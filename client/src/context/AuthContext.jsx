import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../features/auth/api.js';
import { refreshSession, setAccessToken, setSessionExpiredHandler } from '../services/http.js';
import { AuthContext } from './authContextObject.js';

const CHANNEL_NAME = 'lms-auth';

/**
 * status: 'loading' while the initial silent refresh runs, then
 * 'authenticated' or 'anonymous'.
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState({ status: 'loading', user: null });

  const signIn = useCallback(({ user, accessToken }) => {
    setAccessToken(accessToken);
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const signOutLocally = useCallback(() => {
    setAccessToken(null);
    queryClient.clear();
    setState({ status: 'anonymous', user: null });
  }, [queryClient]);

  // Restore the session from the refresh cookie on page load.
  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((session) => !cancelled && signIn(session))
      .catch(() => !cancelled && setState({ status: 'anonymous', user: null }));
    return () => {
      cancelled = true;
    };
  }, [signIn]);

  useEffect(() => {
    setSessionExpiredHandler(signOutLocally);
    return () => setSessionExpiredHandler(() => {});
  }, [signOutLocally]);

  // Keep other open tabs in sync when this tab logs out.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data === 'logout') signOutLocally();
    };
    return () => channel.close();
  }, [signOutLocally]);

  const login = useCallback(async (values) => signIn(await authApi.login(values)), [signIn]);

  const register = useCallback(
    async ({ name, email, password }) => signIn(await authApi.register({ name, email, password })),
    [signIn],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      signOutLocally();
      if (typeof BroadcastChannel !== 'undefined') {
        const channel = new BroadcastChannel(CHANNEL_NAME);
        channel.postMessage('logout');
        channel.close();
      }
    }
  }, [signOutLocally]);

  const updateUser = useCallback((user) => setState((s) => ({ ...s, user })), []);

  const value = useMemo(
    () => ({ ...state, login, register, logout, signIn, updateUser }),
    [state, login, register, logout, signIn, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
