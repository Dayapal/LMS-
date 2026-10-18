import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ThemeContext } from './themeContextObject.js';

const STORAGE_KEY = 'lms-theme';

/** Read the persisted or OS-preferred theme without causing a render. */
function getInitialTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* localStorage may be unavailable (e.g. iframe sandbox) */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** Apply the theme class and color-scheme property to the root element. */
function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.setProperty('color-scheme', theme);
}

/**
 * Provides theme state (`'light'` | `'dark'`) and a `toggleTheme` function.
 *
 * - Persists the choice in `localStorage` under `lms-theme`.
 * - Falls back to `prefers-color-scheme` on first visit.
 * - Toggles the `dark` class on `<html>` so Tailwind's `dark:` variant works.
 * - Sets the `color-scheme` CSS property for native form controls.
 * - Listens for OS-level preference changes when no explicit choice is stored.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);
  // Track whether the user has explicitly toggled (vs. initial OS-derived value).
  const userChose = useRef(false);

  /* Sync DOM whenever theme changes. */
  useEffect(() => {
    applyTheme(theme);
    // Only persist when the user has explicitly toggled, not on the initial
    // OS-derived render, so the matchMedia listener still works on next visit.
    if (userChose.current) {
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        /* ignore write failures */
      }
    }
  }, [theme]);

  /* Listen for OS preference changes (only matters when user hasn't chosen). */
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      /* Only follow OS if the user hasn't explicitly stored a preference. */
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch {
        /* ignore */
      }
      setTheme(e.matches ? 'dark' : 'light');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => {
    userChose.current = true;
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
