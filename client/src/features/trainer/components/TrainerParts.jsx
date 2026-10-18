import { Link } from 'react-router';
import { relativeTime } from '../../assignments/format.js';
import { Badge } from '../../../components/ui/Badge.jsx';
import { activityText, ENROLLMENT_BADGE, studentPath } from '../format.js';

export const linkClass = 'font-semibold text-brand-600 hover:text-brand-700 dark:text-cyan-400 dark:hover:text-cyan-300 hover:underline transition-colors';

export const selectClass =
  'w-full rounded-xl border border-slate-300/80 bg-white/80 px-3.5 py-2 text-sm text-slate-900 shadow-2xs backdrop-blur-md focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-white/15 dark:bg-slate-900/80 dark:text-white dark:focus:border-cyan-400 dark:focus:ring-cyan-400/25 sm:w-auto [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-white';

// Shared with the rest of the app; re-exported for the trainer pages.
export { FilterPills } from '../../../components/ui/FilterPills.jsx';

/** A labelled native select for a filter row. */
export function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 sm:w-auto">
      {label}
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  );
}

export function EnrollmentBadge({ status }) {
  const badge = ENROLLMENT_BADGE[status];
  return badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null;
}

/** Latest learning events, newest first. `showStudent` names the student in each line. */
export function ActivityList({ items, showStudent = true, empty = 'No activity yet.' }) {
  if (items.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">{empty}</p>;
  return (
    <ol className="space-y-3.5">
      {items.map((activity) => (
        <li key={activity.id} className="flex gap-3 text-sm">
          <span
            aria-hidden="true"
            className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500 shadow-[0_0_8px_rgba(3,174,210,0.6)] dark:bg-cyan-400"
          />
          <div className="min-w-0">
            <p className="text-slate-700 dark:text-slate-200">
              {showStudent &&
                (activity.student ? (
                  <Link to={studentPath(activity.student.id)} className={linkClass}>
                    {activity.student.name}
                  </Link>
                ) : (
                  'A deleted student'
                ))}
              {showStudent ? ' ' : ''}
              {showStudent ? activityText(activity) : capitalize(activityText(activity))}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <time
                dateTime={activity.createdAt}
                title={new Date(activity.createdAt).toLocaleString()}
              >
                {relativeTime(activity.createdAt)}
              </time>
              {activity.actor && ` · by ${activity.actor.name}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Horizontal bars, one per row, for a single measure (one hue, values as
 * text beside each bar, so the numbers are readable without the bars).
 */
export function BarList({ label, rows, unit = '' }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul aria-label={label} className="space-y-3">
      {rows.map((row) => (
        <li
          key={row.label}
          className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]"
          title={`${row.label}: ${row.value}${unit}`}
        >
          <span className="truncate text-slate-600 dark:text-slate-400">{row.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10" aria-hidden="true">
            <span
              className="block h-full rounded-full bg-linear-to-r from-brand-500 to-[#029ab8] dark:from-cyan-400 dark:to-brand-500 shadow-[0_0_8px_rgba(3,174,210,0.3)]"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums text-slate-900 dark:text-white">
            {row.value}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
