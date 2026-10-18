const TONES = {
  error:
    'border-rose-300/60 bg-rose-50/80 text-rose-900 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200',
  success:
    'border-emerald-300/60 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200',
  info:
    'border-cyan-300/60 bg-cyan-50/80 text-cyan-950 dark:border-cyan-500/30 dark:bg-cyan-950/30 dark:text-cyan-200',
  warning:
    'border-amber-300/60 bg-amber-50/80 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200',
};

export function Alert({ tone = 'info', title, children, className = '' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border px-4 py-3 text-sm backdrop-blur-md shadow-xs ${TONES[tone] || TONES.info} ${className}`}
    >
      {title && <p className="font-semibold tracking-tight">{title}</p>}
      {children && <div className={title ? 'mt-1 text-sm/relaxed opacity-90' : 'text-sm/relaxed'}>{children}</div>}
    </div>
  );
}
