export const LEVEL_LABEL = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

export function formatMinutes(total) {
  if (!total) return '—';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

export const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Splits plain text into paragraphs on blank lines (Markdown rendering arrives in Phase 3). */
export const paragraphs = (text = '') =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** One item per non-empty line, for objectives and prerequisites textareas. */
export const linesToList = (text = '') =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export const listToLines = (list = []) => list.join('\n');

/** Returns a copy of `ids` with the item at `index` moved by `delta` (-1 or +1). */
export function moveId(ids, index, delta) {
  const target = index + delta;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
