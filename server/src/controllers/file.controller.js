import { pipeline } from 'node:stream/promises';
import * as files from '../services/file.service.js';
import { contentDisposition } from '../utils/contentDisposition.js';
import { created } from '../utils/respond.js';

export async function upload(req, res) {
  created(res, await files.uploadFile(req.user, req.body, req.file));
}

/** Streams a file the viewer may open. Nothing is served from a public path. */
export async function download(req, res) {
  const { file, size, attachment, stream } = await files.openFileForViewer(
    req.user,
    req.valid.params.id,
    { download: req.valid.query.download === '1' },
  );
  res.set({
    'Content-Type': file.mimeType,
    'Content-Length': String(size),
    'Content-Disposition': contentDisposition(
      attachment ? 'attachment' : 'inline',
      file.originalName,
    ),
    'Cache-Control': 'private, no-store',
    'Content-Security-Policy': "default-src 'none'; sandbox",
  });
  try {
    await pipeline(stream(), res);
  } catch (error) {
    // Once bytes are on the wire the response can't become a JSON error.
    if (!res.headersSent) throw error;
    req.log?.warn({ err: error }, 'File stream interrupted');
  }
}
