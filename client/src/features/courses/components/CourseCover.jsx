import { useState } from 'react';

const GRADIENTS = [
  'from-brand-600 to-sky-500',
  'from-amber-500 to-rose-500',
  'from-emerald-600 to-teal-400',
  'from-fuchsia-600 to-purple-500',
  'from-slate-700 to-slate-500',
];

const pick = (seed = '') =>
  GRADIENTS[[...seed].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % GRADIENTS.length];

/** Course thumbnail, or a stable gradient with the course initials when none is set. */
export function CourseCover({ course, className = 'h-36' }) {
  const [failed, setFailed] = useState(false);
  if (course.thumbnailUrl && !failed) {
    return (
      <img
        src={course.thumbnailUrl}
        alt=""
        onError={() => setFailed(true)}
        className={`w-full object-cover ${className}`}
      />
    );
  }
  const initials = course.title
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <div
      aria-hidden="true"
      className={`flex w-full items-center justify-center bg-linear-to-br ${pick(course.slug)} ${className}`}
    >
      <span className="text-3xl font-bold tracking-wider text-white/90">{initials}</span>
    </div>
  );
}
