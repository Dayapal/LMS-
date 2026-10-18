import { useAuth } from '../../hooks/useAuth.js';

export function Welcome({ subtitle }) {
  const { user } = useAuth();
  const firstName = user.name.split(' ')[0];
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
        Welcome, <span className="text-transparent bg-clip-text bg-linear-to-r from-brand-500 to-[#D12052]">{firstName}</span>
      </h1>
      {subtitle && <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>}
    </div>
  );
}
