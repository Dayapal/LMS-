import { useState } from 'react';

const GRADIENTS = [
  'from-[#03AED2] via-[#029ab8] to-[#D12052]',
  'from-[#03AED2] to-[#014d5c]',
  'from-[#F45B26] to-[#D12052]',
  'from-[#F8DE22] via-[#F45B26] to-[#D12052]',
  'from-[#03AED2] via-teal-500 to-emerald-500',
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
      className={`relative flex w-full items-center justify-center overflow-hidden bg-linear-to-br ${pick(course.slug)} ${className}`}
    >
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]" />
      <span className="relative text-3xl font-extrabold tracking-wider text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
        {initials}
      </span>
    </div>
  );
}
