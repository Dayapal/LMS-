/** A labelled progress bar. `value` is a whole percentage from the server. */
export function ProgressBar({ value, label, size = 'md', className = '' }) {
  const percent = Math.min(100, Math.max(0, Math.round(value ?? 0)));
  const isComplete = percent === 100;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10 ring-1 ring-slate-900/5 dark:ring-white/5 backdrop-blur-xs ${size === 'sm' ? 'h-2' : size === 'lg' ? 'h-3.5' : 'h-2.5'} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${
          isComplete
            ? 'bg-linear-to-r from-emerald-500 to-teal-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
            : 'bg-linear-to-r from-brand-500 via-[#03AED2] to-[#028da8] shadow-[0_0_10px_rgba(3,174,210,0.35)]'
        }`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
