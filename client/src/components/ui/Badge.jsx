const TONES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  info: 'bg-brand-50 text-brand-700 ring-brand-200',
  muted: 'bg-slate-50 text-slate-500 ring-slate-200',
};

export function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
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
