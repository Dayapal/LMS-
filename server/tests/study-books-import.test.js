import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {
  validateSafeZipPath,
  parseZipBuffer,
  classifyBookEntries,
  importStudyBooks,
} from '../src/services/studyBookImport.service.js';

/**
 * Minimal in-memory ZIP builder for testing zip slip, decompression bomb,
 * and standard archive extraction.
 */
function buildTestZip(files) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const file of files) {
    const filenameBuf = Buffer.from(file.name, 'utf8');
    const contentBuf = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content || '', 'utf8');

    const method = file.method ?? 8; // default DEFLATE
    const compressed = method === 8 ? zlib.deflateRawSync(contentBuf) : contentBuf;

    // Local Header (30 bytes + name)
    const local = Buffer.alloc(30 + filenameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8); // compression
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(0, 14); // crc32 (placeholder)
    local.writeUInt32LE(compressed.length, 18); // comp size
    local.writeUInt32LE(contentBuf.length, 22); // uncomp size
    local.writeUInt16LE(filenameBuf.length, 26); // name length
    local.writeUInt16LE(0, 28); // extra length
    filenameBuf.copy(local, 30);

    localHeaders.push(local, compressed);

    // Central Directory Header (46 bytes + name)
    const central = Buffer.alloc(46 + filenameBuf.length);
    central.writeUInt32LE(0x02014b50, 0); // signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(method, 10); // compression
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(0, 16); // crc32
    central.writeUInt32LE(compressed.length, 20); // comp size
    central.writeUInt32LE(contentBuf.length, 24); // uncomp size
    central.writeUInt16LE(filenameBuf.length, 28); // name length
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk num
    central.writeUInt16LE(0, 36); // internal attr
    central.writeUInt32LE(file.externalAttr ?? 0, 38); // external attr
    central.writeUInt32LE(offset, 42); // local header offset
    filenameBuf.copy(central, 46);

    centralHeaders.push(central);
    offset += local.length + compressed.length;
  }

  const cdBuf = Buffer.concat(centralHeaders);

  // End of Central Directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk num
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(files.length, 8); // entries on disk
  eocd.writeUInt16LE(files.length, 10); // total entries
  eocd.writeUInt32LE(cdBuf.length, 12); // cd size
  eocd.writeUInt32LE(offset, 16); // cd offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, cdBuf, eocd]);
}

describe('Study Book Import & Storage Security (Phase 9)', () => {
  describe('validateSafeZipPath & Zip Slip Protection', () => {
    it('accepts safe relative paths', () => {
      expect(validateSafeZipPath('DSA-Study-Material-in_JS/Module-1DSA.html')).toBe(
        'DSA-Study-Material-in_JS/Module-1DSA.html',
      );
      expect(validateSafeZipPath('ReactjsStudy-Material/phase-11-Reactjs.html')).toBe(
        'ReactjsStudy-Material/phase-11-Reactjs.html',
      );
    });

    it('rejects path traversal with parent directory markers (..)', () => {
      expect(() => validateSafeZipPath('../etc/passwd')).toThrow(/Zip traversal attack/);
      expect(() => validateSafeZipPath('DSA-Study-Material/../../server.js')).toThrow(
        /Zip traversal attack/,
      );
      expect(() => validateSafeZipPath('..\\Windows\\System32')).toThrow(/Zip traversal attack/);
    });

    it('rejects absolute paths and drive letters', () => {
      expect(() => validateSafeZipPath('/etc/shadow')).toThrow(/Zip traversal attack/);
      expect(() => validateSafeZipPath('\\Windows\\win.ini')).toThrow(/Zip traversal attack/);
      expect(() => validateSafeZipPath('C:/Users/Administrator')).toThrow(/Zip traversal attack/);
      expect(() => validateSafeZipPath('D:\\secret.txt')).toThrow(/Zip traversal attack/);
    });
  });

  describe('parseZipBuffer Extraction & Decompression Bomb Guards', () => {
    it('extracts valid ZIP entries and calculates SHA-256 hashes', () => {
      const zipBuf = buildTestZip([
        {
          name: 'DSA-Study-Material-in_JS/Module-1DSA.html',
          content: '<html><head><title>DSA 1</title></head><body>Hello DSA</body></html>',
        },
        {
          name: 'JavaScript-All/JavaScript-Phase-1.html',
          content: '<html><head><title>JS 1</title></head><body>Hello JS</body></html>',
        },
      ]);

      const entries = parseZipBuffer(zipBuf);
      expect(entries).toHaveLength(2);
      expect(entries[0].path).toBe('DSA-Study-Material-in_JS/Module-1DSA.html');
      expect(entries[0].buffer.toString('utf8')).toContain('Hello DSA');
      expect(entries[0].hash).toMatch(/^[a-f0-9]{64}$/);
      expect(entries[1].path).toBe('JavaScript-All/JavaScript-Phase-1.html');
    });

    it('rejects decompression bombs when total uncompressed size exceeds limit', () => {
      const largeContent = Buffer.alloc(5000, 'A');
      const zipBuf = buildTestZip([
        { name: 'big1.html', content: largeContent },
        { name: 'big2.html', content: largeContent },
      ]);

      // Test with small limit of 8000 bytes
      expect(() => parseZipBuffer(zipBuf, { maxTotalBytes: 8000 })).toThrow(/Decompression bomb/);
    });

    it('rejects symlinks in archive entries', () => {
      const zipBuf = buildTestZip([
        {
          name: 'malicious-link',
          content: '/etc/passwd',
          externalAttr: (0o120777 << 16) >>> 0, // Unix symlink mode
        },
      ]);

      expect(() => parseZipBuffer(zipBuf)).toThrow(/symbolic link detected/);
    });
  });

  describe('classifyBookEntries & Duplicate Detection', () => {
    it('groups modules by book and detects duplicate mirrors', () => {
      const duplicateContent = '<html><head><title>Duplicate Phase</title></head></html>';
      const duplicateHash = crypto.createHash('sha256').update(duplicateContent).digest('hex');

      const rawEntries = [
        {
          path: 'ReactjsStudy-Material/phase-11-Reactjs.html',
          isDirectory: false,
          size: duplicateContent.length,
          hash: duplicateHash,
          buffer: Buffer.from(duplicateContent),
        },
        {
          path: 'ReactjsStudy-Material/phase-12.html',
          isDirectory: false,
          size: duplicateContent.length,
          hash: duplicateHash,
          buffer: Buffer.from(duplicateContent),
        },
      ];

      const classified = classifyBookEntries(rawEntries);
      expect(classified).toHaveLength(1);
      expect(classified[0].slug).toBe('react-js');
      expect(classified[0].modules).toHaveLength(2);

      const mod1 = classified[0].modules[0];
      const mod2 = classified[0].modules[1];

      // First instance is published
      expect(mod1.isDuplicateMirror).toBe(false);
      expect(mod1.status).toBe('published');

      // Duplicate mirror is flagged draft by default
      expect(mod2.isDuplicateMirror).toBe(true);
      expect(mod2.status).toBe('draft');
    });
  });

  describe('importStudyBooks in Dry-Run Mode', () => {
    it('produces dry-run report without modifying filesystem or database', async () => {
      const zipBuf = buildTestZip([
        {
          name: 'DSA-Study-Material-in_JS/Module-1DSA.html',
          content: '<!DOCTYPE html><html><head><title>DSA 1</title></head><body>Test</body></html>',
        },
      ]);

      const report = await importStudyBooks({
        archiveBuffer: zipBuf,
        dryRun: true,
      });

      expect(report.success).toBe(true);
      expect(report.dryRun).toBe(true);
      expect(report.booksCount).toBe(1);
      expect(report.htmlCount).toBe(1);
      expect(report.books[0].slug).toBe('dsa-javascript');
      expect(report.books[0].modules[0].originalFilename).toBe('Module-1DSA.html');
    });
  });
});
