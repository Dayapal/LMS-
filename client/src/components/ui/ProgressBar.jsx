/** A labelled progress bar. `value` is a whole percentage from the server. */
export function ProgressBar({ value, label, size = 'md', className = '' }) {
  const percent = Math.min(100, Math.max(0, Math.round(value ?? 0)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`overflow-hidden rounded-full bg-slate-200 ${size === 'sm' ? 'h-1.5' : 'h-2.5'} ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] ${percent === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
