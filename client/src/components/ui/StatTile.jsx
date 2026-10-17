import { Link } from 'react-router';

/**
 * One headline number inside a `<dl>`. `tone="danger"` turns a non-zero value
 * red. With `to`, the label links to where the number comes from.
 */
export function StatTile({ label, value, tone = 'default', hint, to }) {
  const alert = tone === 'danger' && value > 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
      <dt className="text-xs font-medium text-slate-500">
        {to ? (
          <Link to={to} className="hover:text-brand-700 hover:underline">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className={`mt-1 text-2xl font-semibold ${alert ? 'text-red-700' : 'text-slate-900'}`}>
        {value}
      </dd>
      {hint && <dd className="mt-0.5 text-xs text-slate-500">{hint}</dd>}
    </div>
  );
}
