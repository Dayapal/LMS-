import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { config } from '../src/config/env.js';
import { Material } from '../src/models/index.js';
import { buildPdf } from '../src/seeds/pdf.js';
import { api } from './helpers.js';
import { bearer } from './content-helpers.js';

export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export const samplePdf = (title = 'Sample handout') =>
  buildPdf({ title, sections: [{ heading: 'Notes', text: ['A small test document.'] }] });

/** A minimal uncompressed ZIP archive containing `entries` ({ name: string content }). */
export function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, data);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + data.length;
  }
  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

const officeDocument = (part, mainType) =>
  makeZip({
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${part}" ContentType="${mainType}"/></Types>`,
    [part]: '<?xml version="1.0"?><document/>',
  });

export const sampleDocx = () =>
  officeDocument(
    'word/document.xml',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  );

export const samplePptx = () =>
  officeDocument(
    'ppt/presentation.xml',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
  );

/** POST /files as `user`. */
export function upload(
  app,
  user,
  { buffer, filename, contentType, courseId, purpose = 'material' },
) {
  const req = api(app).post('/api/v1/files').set(bearer(user));
  if (purpose !== undefined) req.field('purpose', purpose);
  if (courseId !== undefined) req.field('courseId', String(courseId));
  if (buffer) req.attach('file', buffer, { filename, contentType });
  return req;
}

/** Uploads a PDF for `course` as `admin` and returns the file DTO. */
export async function uploadPdf(app, admin, course, filename = 'handout.pdf') {
  const res = await upload(app, admin, {
    buffer: samplePdf(),
    filename,
    contentType: PDF_MIME,
    courseId: course.id,
  });
  if (res.status !== 201) throw new Error(`Upload failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

/** Inserts a file material directly. */
export const attachFile = (lesson, fileId, overrides = {}) =>
  Material.create({
    lesson: lesson._id,
    course: lesson.course,
    type: 'file',
    title: 'Handout',
    order: 0,
    status: 'published',
    file: fileId,
    downloadable: true,
    ...overrides,
  });

/** Every stored file under the test upload directory, as relative paths. */
export async function storedFiles() {
  try {
    const entries = await fs.readdir(config.storage.localDir, { recursive: true });
    const files = [];
    for (const entry of entries) {
      const stat = await fs.stat(path.join(config.storage.localDir, entry));
      if (stat.isFile()) files.push(entry.replaceAll('\\', '/'));
    }
    return files;
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/** Supertest parser that collects a binary body into a Buffer. */
export function binary(res, callback) {
  const chunks = [];
  res.on('data', (chunk) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}
