export const SUBMISSION_TYPES = [
  { value: 'github_url', label: 'GitHub repository' },
  { value: 'project_url', label: 'Deployed project' },
  { value: 'drive_url', label: 'Google Drive link' },
  { value: 'pdf', label: 'PDF upload' },
  { value: 'code', label: 'Code snippet' },
];

const TYPE_LABEL = Object.fromEntries(SUBMISSION_TYPES.map((t) => [t.value, t.label]));
export const submissionTypeLabel = (type) => TYPE_LABEL[type] ?? type;

/** Badge tone and label for a student's state or a submission's status. */
export const SUBMISSION_STATE = {
  pending: { tone: 'neutral', label: 'Not submitted' },
  overdue: { tone: 'danger', label: 'Overdue' },
  submitted: { tone: 'info', label: 'Submitted' },
  reviewed: { tone: 'success', label: 'Reviewed' },
  resubmit_requested: { tone: 'warning', label: 'Resubmission requested' },
};

const dateTimeFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const zoneFormat = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' });

/** The viewer's time-zone abbreviation at `date`, e.g. "GMT+5:30". */
const zoneOf = (date) =>
  zoneFormat.formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? '';

/** A UTC instant in the browser's local time, with the time zone shown (spec §12). */
export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return `${dateTimeFormat.format(date)} ${zoneOf(date)}`.trim();
}

/** The browser's IANA time zone, for form hints. */
export const localTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

const pad = (n) => String(n).padStart(2, '0');

/** An ISO instant as a `datetime-local` input value, in local time. */
export function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** A `datetime-local` value (local time) as an ISO instant in UTC. */
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

const UNITS = [
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
];

/** How far `value` is from `now`: "in 3 days", "2 hours ago". */
export function relativeTime(value, now = new Date()) {
  const diff = new Date(value).getTime() - now.getTime();
  const format = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const [unit, ms] = UNITS.find(([, size]) => Math.abs(diff) >= size) ?? UNITS.at(-1);
  return format.format(Math.round(diff / ms), unit);
}

/** One sentence describing the late policy. */
export function latePolicyText({ allowLate, lateUntil, penaltyPercent }) {
  if (!allowLate) return 'Late work is not accepted.';
  const penalty = penaltyPercent ? `with a ${penaltyPercent}% penalty` : 'without a penalty';
  return `Late work is accepted until ${formatDateTime(lateUntil)}, ${penalty}.`;
}

export const attemptsText = (maxAttempts) =>
  maxAttempts ? `${maxAttempts} attempt${maxAttempts === 1 ? '' : 's'}` : 'Unlimited attempts';

/** "45.5 / 50", or "—" before grading. */
export const formatMarks = (marks, maxMarks) =>
  marks == null ? '—' : `${Number(marks.toFixed(2))} / ${maxMarks}`;
