/**
 * Filter buttons with optional counts. Each is a toggle (`aria-pressed`)
 * inside a labelled group: they filter one list, so they aren't tabs.
 */
export function FilterPills({ label, options, value, counts, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((option) => {
        const count = counts?.[option.value];
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              value === option.value
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {option.label}
            {count != null && <span className="ml-1.5 tabular-nums opacity-80">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
