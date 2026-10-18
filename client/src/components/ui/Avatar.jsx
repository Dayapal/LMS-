import { useState } from 'react';

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

export function Avatar({ name, src, className = 'size-9 text-sm' }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className={`rounded-full object-cover ring-2 ring-white/40 dark:ring-white/20 ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-full bg-linear-to-br from-brand-500 via-[#03AED2] to-[#D12052] font-semibold text-white shadow-xs ring-2 ring-white/40 dark:ring-white/20 ${className}`}
    >
      {initials(name)}
    </span>
  );
}
