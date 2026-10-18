import { Link } from 'react-router';

/**
 * One headline metric inside a `<dl>`. `tone="danger"` turns a non-zero value
 * accented. With `to`, the label links to where the number comes from.
 */
export function StatTile({ label, value, tone = 'default', hint, to }) {
  const alert = tone === 'danger' && value > 0;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] backdrop-blur-xl transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:shadow-[0_4px_24px_rgba(0,0,0,0.3)] dark:hover:border-white/20 dark:hover:bg-white/[0.08]">
      {/* Subtle brand accent glow line at top */}
      <div
        className={`absolute inset-x-0 top-0 h-0.5 transition-opacity ${
          alert
            ? 'bg-linear-to-r from-[#F45B26] to-[#D12052] opacity-80'
            : 'bg-linear-to-r from-brand-500 to-[#03AED2] opacity-40 group-hover:opacity-100'
        }`}
      />
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
        {to ? (
          <Link
            to={to}
            className="transition-colors hover:text-brand-600 dark:hover:text-cyan-400 hover:underline"
          >
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd
        className={`mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl ${
          alert
            ? 'text-red-700 text-[#D12052] dark:text-rose-400'
            : 'text-slate-900 dark:text-white'
        }`}
      >
        {value}
      </dd>
      {hint && (
        <dd className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </dd>
      )}
    </div>
  );
}
