import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { StudyBook, StudyModule } from '../src/models/index.js';
import {
  STUDY_BOOKS_DATA,
  STUDY_MODULES_DATA,
} from '../src/seeds/data/studyMaterials.js';
import {
  resetStudyMaterials,
  seedStudyBooks,
  seedStudyMaterials,
  seedStudyModules,
} from '../src/seeds/studyMaterials.seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root content/study-materials path
const MATERIALS_ROOT = path.resolve(__dirname, '../../content/study-materials');

describe('Study Materials — File Integrity & Preservation', () => {
  it('contains exactly 27 HTML files across the three subject directories', async () => {
    async function getHtmlFiles(dir) {
      let results = [];
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results = results.concat(await getHtmlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const diskFiles = await getHtmlFiles(MATERIALS_ROOT);
    expect(diskFiles).toHaveLength(27);
  });

  it('preserves all 27 original HTML files byte-for-byte with exact SHA-256 hashes', async () => {
    expect(STUDY_MODULES_DATA).toHaveLength(27);

    for (const mod of STUDY_MODULES_DATA) {
      const diskPath = path.join(MATERIALS_ROOT, mod.sourcePath);
      const exists = await fs
        .access(diskPath)
        .then(() => true)
        .catch(() => false);
      expect(exists, `File must exist on disk: ${mod.sourcePath}`).toBe(true);

      const buffer = await fs.readFile(diskPath);
      expect(buffer.length, `Byte length must match for ${mod.originalFilename}`).toBe(mod.fileBytes);

      const computedHash = crypto.createHash('sha256').update(buffer).digest('hex');
      expect(computedHash, `SHA-256 integrity hash must match for ${mod.originalFilename}`).toBe(
        mod.fileHash,
      );
    }
  });

  it('retains original filenames verbatim including quirks and duplicates', () => {
    const filenames = STUDY_MODULES_DATA.map((m) => m.originalFilename);

    // Verify React Phase 3 duplicate pair
    expect(filenames).toContain('phase-3-React.html');
    expect(filenames).toContain('React-phase-3.html');

    // Verify JS Phase 1 & 2 duplicate pair
    expect(filenames).toContain('JavaScript-Phase-1.html');
    expect(filenames).toContain('Javascript-Phase-2.html');

    // Verify React Phase 4 & 5 duplicate pair
    expect(filenames).toContain('phase-4-O-Reactjs.html');
    expect(filenames).toContain('phase-5-React.html');

    // Verify React Phase 8 typo filename preserved
    expect(filenames).toContain('phase-8-Reacj.html');

    // Verify JS Phase 6 filename preserved
    expect(filenames).toContain('JavaScript-phase-6.html');
  });
});

describe('Study Materials — Database Seeding & Catalogue', () => {
  it('seeds the 3 study books with distinct categories and glassmorphism gradients', async () => {
    expect(STUDY_BOOKS_DATA).toHaveLength(3);
    const results = await seedStudyBooks();
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.created)).toBe(true);

    const books = await StudyBook.find().sort({ order: 1 });
    expect(books.map((b) => b.slug)).toEqual(['dsa-javascript', 'javascript', 'react-js']);
    expect(books.map((b) => b.category)).toEqual(['dsa', 'javascript', 'react']);
    expect(books.every((b) => b.status === 'published')).toBe(true);
    expect(books.every((b) => b.gradient.includes('gradient'))).toBe(true);
  });

  it('seeds all 27 modules with correct book association, orders, and statuses', async () => {
    await seedStudyBooks();
    const { added, updated, total } = await seedStudyModules();
    expect(total).toBe(27);
    expect(added).toBe(27);
    expect(updated).toBe(0);

    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const jsBook = await StudyBook.findOne({ slug: 'javascript' });
    const reactBook = await StudyBook.findOne({ slug: 'react-js' });

    const dsaModules = await StudyModule.find({ book: dsaBook._id }).sort({ order: 1 });
    const jsModules = await StudyModule.find({ book: jsBook._id }).sort({ order: 1 });
    const reactModules = await StudyModule.find({ book: reactBook._id }).sort({ order: 1 });

    expect(dsaModules).toHaveLength(9);
    expect(jsModules).toHaveLength(8);
    expect(reactModules).toHaveLength(10);

    // Verify DSA module sequence
    expect(dsaModules.map((m) => m.phaseLabel)).toEqual([
      'Module 1',
      'Module 2',
      'Module 3',
      'Module 4',
      'Module 5',
      'Module 6',
      'Module 7',
      'Module 8',
      'Module 9',
    ]);
    expect(dsaModules.every((m) => m.status === 'published')).toBe(true);

    // Verify JS Phase 5 resolution
    const jsPhase5 = jsModules.find((m) => m.slug === 'js-phase-5');
    expect(jsPhase5.title).toContain('Phase 5');
    expect(jsPhase5.originalFilename).toBe('JavaScript-phase-6.html');

    // Verify duplicate mirrors are marked as draft
    const jsPhase2Mirror = jsModules.find((m) => m.slug === 'js-phase-2-mirror');
    expect(jsPhase2Mirror.status).toBe('draft');
    expect(jsPhase2Mirror.phaseLabel).toContain('Mirror');

    const reactPhase3Mirror = reactModules.find((m) => m.slug === 'react-phase-3-mirror');
    expect(reactPhase3Mirror.status).toBe('draft');
    expect(reactPhase3Mirror.phaseLabel).toContain('Mirror');

    const reactPhase5Mirror = reactModules.find((m) => m.slug === 'react-phase-5-duplicate');
    expect(reactPhase5Mirror.status).toBe('draft');
    expect(reactPhase5Mirror.phaseLabel).toContain('Mirror');
  });

  it('is completely idempotent on multiple seed runs', async () => {
    await seedStudyMaterials();
    expect(await StudyBook.countDocuments()).toBe(3);
    expect(await StudyModule.countDocuments()).toBe(27);

    // Re-run
    const rerun = await seedStudyMaterials();
    expect(rerun.books.every((b) => !b.created)).toBe(true);
    expect(rerun.modules.added).toBe(0);
    expect(rerun.modules.updated).toBe(27);
    expect(await StudyBook.countDocuments()).toBe(3);
    expect(await StudyModule.countDocuments()).toBe(27);
  });

  it('resets study materials completely when requested', async () => {
    await seedStudyMaterials();
    expect(await StudyBook.countDocuments()).toBe(3);
    expect(await StudyModule.countDocuments()).toBe(27);

    await resetStudyMaterials();
    expect(await StudyBook.countDocuments()).toBe(0);
    expect(await StudyModule.countDocuments()).toBe(0);
  });
});
