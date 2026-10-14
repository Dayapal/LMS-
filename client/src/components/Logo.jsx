export function Logo({ tone = 'dark', className = '' }) {
  const text = tone === 'light' ? 'text-white' : 'text-slate-900';
  return (
    <span className={`inline-flex items-center gap-2.5 font-semibold ${text} ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#4338ca" />
        <path d="M8 11.5 16 8l8 3.5-8 3.5-8-3.5Z" fill="#fff" />
        <path d="M11 14.3v4.2c0 1.6 2.2 3 5 3s5-1.4 5-3v-4.2l-5 2.2-5-2.2Z" fill="#c7d2fe" />
        <path d="M24 11.5v6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>Training LMS</span>
    </span>
  );
}
