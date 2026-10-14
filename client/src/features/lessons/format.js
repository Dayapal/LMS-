export const MATERIAL_TYPE_LABEL = {
  note: 'Note',
  code: 'Code',
  file: 'File',
  link: 'Link',
};

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const FILE_KIND = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint slides',
};

export const fileKind = (mimeType) => FILE_KIND[mimeType] ?? 'File';

export const isPdf = (file) => file?.mimeType === 'application/pdf';

/** A one-line summary of a material for the trainer's list. */
export function materialSummary(material) {
  switch (material.type) {
    case 'note': {
      const firstLine = material.body
        .split('\n')
        .map((line) => line.replace(/^#+\s*/, '').trim())
        .find(Boolean);
      return firstLine ?? '';
    }
    case 'code': {
      const lines = material.source.split('\n').length;
      return `${lines} line${lines === 1 ? '' : 's'}${material.caption ? ` · ${material.caption}` : ''}`;
    }
    case 'file':
      return material.file
        ? `${material.file.originalName} · ${formatBytes(material.file.size)}${
            material.downloadable ? '' : ' · view only'
          }`
        : 'File missing';
    default:
      return material.url;
  }
}
