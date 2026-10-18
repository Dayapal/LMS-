import { Spinner } from './Spinner.jsx';

const VARIANTS = {
  primary:
    'bg-linear-to-r from-brand-500 to-[#029ab8] text-white shadow-xs hover:shadow-[0_0_20px_rgba(3,174,210,0.35)] hover:from-brand-600 hover:to-brand-700 active:scale-[0.98] disabled:opacity-60 disabled:hover:shadow-none',
  secondary:
    'bg-white/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/15 backdrop-blur-md shadow-2xs hover:bg-white dark:hover:bg-white/[0.18] hover:text-slate-900 dark:hover:text-white active:scale-[0.98] disabled:opacity-50',
  ghost:
    'text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white active:scale-[0.98] disabled:opacity-50',
  danger:
    'bg-linear-to-r from-[#D12052] to-[#b81443] text-white shadow-xs hover:shadow-[0_0_18px_rgba(209,32,82,0.35)] hover:from-[#b81443] hover:to-[#960f34] active:scale-[0.98] disabled:opacity-60 disabled:hover:shadow-none',
  gradient:
    'bg-linear-to-r from-[#03AED2] via-[#F45B26] to-[#D12052] text-white shadow-xs hover:shadow-[0_0_20px_rgba(244,91,38,0.35)] active:scale-[0.98] disabled:opacity-60',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-base gap-2 rounded-xl',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  type = 'button',
  disabled,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center font-medium transition-all duration-200 disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {loading && <Spinner className="size-4 shrink-0" label="Working" />}
      {children}
    </button>
  );
}
