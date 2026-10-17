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
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none sm:w-64"
    />
  );
  return { q, input };
}
