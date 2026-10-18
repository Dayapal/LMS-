import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastContext } from './toastContextObject.js';

const TONES = {
  success:
    'border-emerald-300/60 bg-white/90 text-emerald-900 dark:border-emerald-500/30 dark:bg-[#0f172a]/95 dark:text-emerald-200 shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)]',
  error:
    'border-rose-300/60 bg-white/90 text-rose-900 dark:border-rose-500/30 dark:bg-[#0f172a]/95 dark:text-rose-200 shadow-[0_10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)]',
};

const DURATION = { success: 3500, error: 6000 };

/** One toast. Its timer stops while the pointer is over it or focus is inside it. */
function Toast({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(DURATION[toast.tone]);

  useEffect(() => {
    if (paused) return undefined;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, toast.id, onDismiss]);

  return (
    <div
      role={toast.tone === 'error' ? 'alert' : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border px-4 py-3.5 text-sm backdrop-blur-2xl transition-all ${TONES[toast.tone]}`}
    >
      <p className="flex-1 font-medium leading-snug">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-m-1 rounded-lg p-1 text-slate-400 transition-colors hover:text-slate-800 dark:hover:text-slate-100"
        aria-label="Dismiss message"
      >
        <span aria-hidden="true" className="text-base font-semibold leading-none">×</span>
      </button>
    </div>
  );
}

/**
 * Short success and error messages.
 * - Shown at the top of the screen, below the mobile header, so they never
 *   cover the controls at the bottom of a page (lesson navigation, pagination,
 *   form buttons).
 * - Success messages are read out politely; errors are alerts.
 * - The timer pauses on hover and focus, and each has a Dismiss button.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback((tone, message) => {
    const id = (nextId.current += 1);
    setToasts((list) => [...list.slice(-2), { id, tone, message }]);
  }, []);

  const api = useMemo(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
    }),
    [show],
  );

  const render = (tone) =>
    toasts
      .filter((toast) => toast.tone === tone)
      .map((toast) => <Toast key={toast.id} toast={toast} onDismiss={dismiss} />);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-20 z-60 flex flex-col items-center gap-2 px-4 lg:top-5 lg:pl-68">
        <div className="flex w-full flex-col items-center gap-2">{render('error')}</div>
        <div role="status" aria-atomic="false" className="flex w-full flex-col items-center gap-2">
          {render('success')}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
