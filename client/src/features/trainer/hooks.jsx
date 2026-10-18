import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDebouncedValue } from '../../hooks/useDebouncedValue.js';

/**
 * Filters kept in the URL, so the back button and the review page's
 * "back to the queue" link return to the same view. Changing a filter goes
 * back to page 1.
 */
export function useUrlFilters(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const get = (key) => searchParams.get(key) ?? defaults[key] ?? '';
  const update = (changes) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value && value !== defaults[key]) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    setSearchParams(next, { replace: true });
  };
  return { get, update, page: Number(searchParams.get('page') ?? 1) || 1 };
}

/** A search box that updates the URL; returns the debounced text to query with. */
export function useSearch(filters, label) {
  const [text, setText] = useState(filters.get('q'));
  const q = useDebouncedValue(text.trim(), 300);
  const input = (
    <div className="relative w-full sm:w-64">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 dark:text-slate-500">
        <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <input
        type="search"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          filters.update({ q: event.target.value.trim() });
        }}
        placeholder={label}
        aria-label={label}
        maxLength={100}
        className="w-full rounded-xl border border-slate-300/80 bg-white/80 pl-9.5 pr-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs backdrop-blur-md focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-white/15 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/25 transition-all"
      />
    </div>
  );
  return { q, input };
}
