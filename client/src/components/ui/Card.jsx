export function Card({ as: Tag = 'section', className = '', children, ...props }) {
  return (
    <Tag
      className={`rounded-2xl border border-slate-200/70 bg-white/75 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 dark:border-white/10 dark:bg-white/[0.05] dark:backdrop-blur-2xl dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 border-b border-slate-200/60 px-5 py-4 dark:border-white/10 sm:px-6 ${className}`}>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function CardBody({ className = '', children }) {
  return <div className={`px-5 py-5 sm:px-6 ${className}`}>{children}</div>;
}

export function GlassPanel({ className = '', children, ...props }) {
  return (
    <div
      className={`rounded-3xl border border-slate-200/80 bg-white/80 backdrop-blur-2xl shadow-[0_12px_40px_rgb(0,0,0,0.06)] dark:border-white/15 dark:bg-white/[0.07] dark:shadow-[0_12px_40px_0_rgba(0,0,0,0.5)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
