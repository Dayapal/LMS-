import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Conventions that the Phase 8 axe scan found broken and that are easy to
// reintroduce. Checked on the source, so every page is covered.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceFiles(dir = SRC) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(jsx?|tsx?)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles().map((file) => ({
  file: path.relative(SRC, file).replaceAll('\\', '/'),
  text: readFileSync(file, 'utf8'),
}));

describe('accessibility conventions', () => {
  it('names loading placeholders on a status region (aria-label on a plain div is ignored)', () => {
    const offenders = files.flatMap(({ file, text }) =>
      [...text.matchAll(/<div\b[^>]*aria-label=["{`][^>]*>/g)]
        .filter(([tag]) => !/\brole=/.test(tag))
        .map(([tag]) => `${file}: ${tag}`),
    );
    expect(offenders).toEqual([]);
  });

  it('imports zod only through utils/zod.js (jitless, for the production CSP)', () => {
    const offenders = files
      .filter(({ file, text }) => file !== 'utils/zod.js' && /from 'zod'/.test(text))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
