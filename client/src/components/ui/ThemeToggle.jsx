import { useTheme } from '../../hooks/useTheme.js';

/**
 * Accessible theme toggle button.
 *
 * Displays a sun icon in dark mode (to switch to light) and a moon icon in
 * light mode (to switch to dark). The icon swaps with a smooth CSS transition.
 */
export function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`
        group relative inline-flex h-9 w-9 items-center justify-center
        rounded-xl
        bg-white/70 dark:bg-white/10
        border border-slate-200/60 dark:border-white/15
        text-slate-600 dark:text-slate-300
        shadow-sm dark:shadow-none
        backdrop-blur-sm
        transition-all duration-300 ease-in-out
        hover:bg-white/90 dark:hover:bg-white/[0.16]
        hover:text-cyan-600 dark:hover:text-cyan-400
        hover:border-cyan-300/50 dark:hover:border-cyan-500/30
        hover:shadow-md dark:hover:shadow-[0_0_12px_rgba(3,174,210,0.15)]
        focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-cyan-500
        ${className}
      `}
    >
      {/* Sun icon — visible in dark mode (click to go light) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`
          absolute h-5 w-5 transition-all duration-300
          ${isDark ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}
        `}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="m4.93 4.93 1.41 1.41" />
        <path d="m17.66 17.66 1.41 1.41" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="m6.34 17.66-1.41 1.41" />
        <path d="m19.07 4.93-1.41 1.41" />
      </svg>

      {/* Moon icon — visible in light mode (click to go dark) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`
          absolute h-5 w-5 transition-all duration-300
          ${isDark ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}
        `}
      >
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
      </svg>
    </button>
  );
}
