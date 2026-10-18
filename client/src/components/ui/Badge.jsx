const TONES = {
  neutral: 'bg-slate-100/90 text-slate-700 dark:bg-white/10 dark:text-slate-300 ring-slate-300/60 dark:ring-white/15',
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30 dark:ring-emerald-400/30',
  warning: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 ring-amber-500/30 dark:ring-amber-400/30',
  info: 'bg-brand-500/15 text-brand-700 dark:text-cyan-300 ring-brand-500/30 dark:ring-cyan-400/30',
  danger: 'bg-[#D12052]/15 text-[#D12052] dark:text-rose-300 ring-[#D12052]/30 dark:ring-rose-400/30',
  muted: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 ring-slate-500/20 dark:ring-white/10',
  yellow: 'bg-[#F8DE22]/20 text-amber-900 dark:text-yellow-300 ring-[#F8DE22]/40',
  orange: 'bg-[#F45B26]/15 text-[#F45B26] dark:text-orange-300 ring-[#F45B26]/30',
};

export function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ring-1 ring-inset backdrop-blur-xs transition-colors ${TONES[tone] || TONES.neutral} ${className}`}
    >
      {children}
    </span>
  );
}

const CONTENT_STATUS = {
  draft: { tone: 'warning', label: 'Draft' },
  published: { tone: 'success', label: 'Published' },
  archived: { tone: 'muted', label: 'Archived' },
};

export function StatusBadge({ status }) {
  const { tone, label } = CONTENT_STATUS[status] ?? { tone: 'neutral', label: status };
  return <Badge tone={tone}>{label}</Badge>;
}
