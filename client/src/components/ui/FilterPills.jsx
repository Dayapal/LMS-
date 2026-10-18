/**
 * Filter buttons with optional counts. Each is a toggle (`aria-pressed`)
 * inside a labelled group: they filter one list, so they aren't tabs.
 */
export function FilterPills({ label, options, value, counts, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const count = counts?.[option.value];
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all duration-200 ${
              isSelected
                ? 'bg-linear-to-r from-brand-500 to-[#029ab8] text-white shadow-xs dark:shadow-[0_0_15px_rgba(3,174,210,0.35)]'
                : 'bg-white/75 text-slate-600 ring-1 ring-slate-200/80 backdrop-blur-md hover:bg-white hover:text-slate-900 dark:bg-white/10 dark:text-slate-300 dark:ring-white/15 dark:hover:bg-white/[0.18] dark:hover:text-white'
            }`}
          >
            {option.label}
            {count != null && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.2 text-xs font-semibold tabular-nums ${
                  isSelected
                    ? 'bg-white/25 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-white/15 dark:text-slate-300'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
