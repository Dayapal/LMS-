export function Logo({ tone = 'dark', className = '' }) {
  const text = tone === 'light' ? 'text-white' : 'text-slate-900 dark:text-white';
  return (
    <span className={`inline-flex items-center gap-3 font-bold tracking-tight ${text} ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0 drop-shadow-[0_2px_10px_rgba(3,174,210,0.35)]" aria-hidden="true">
        <defs>
          <linearGradient id="logo-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#03AED2" />
            <stop offset="60%" stopColor="#029ab8" />
            <stop offset="100%" stopColor="#D12052" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="10" fill="url(#logo-brand-grad)" />
        <path d="M8 11.5 16 8l8 3.5-8 3.5-8-3.5Z" fill="#fff" />
        <path d="M11 14.3v4.2c0 1.6 2.2 3 5 3s5-1.4 5-3v-4.2l-5 2.2-5-2.2Z" fill="#e6f8fb" />
        <path d="M24 11.5v6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span className="text-base sm:text-lg">Training LMS</span>
    </span>
  );
}
