/**
 * A tiny text-only PDF writer for the seeded cheat sheets: A4 pages, the
 * standard Helvetica and Courier fonts, automatic page breaks and word wrap.
 * Not a general-purpose PDF library.
 */

const PAGE = { width: 595, height: 842, margin: 56 };
const STYLES = {
  title: { font: 'F2', size: 20, leading: 28 },
  subtitle: { font: 'F1', size: 10.5, leading: 22 },
  heading: { font: 'F2', size: 13, leading: 22 },
  text: { font: 'F1', size: 10.5, leading: 15 },
  code: { font: 'F3', size: 9.5, leading: 13 },
  footer: { font: 'F1', size: 8.5, leading: 10 },
};
// Rough characters per line: Helvetica averages about half an em per character.
const WRAP_AT = 92;

const REPLACEMENTS = { '—': '-', '–': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '→': '->' };

/** Standard PDF fonts only cover Latin-1, so keep text to printable ASCII. */
function toPdfText(value) {
  const ascii = [...value]
    .map((char) => REPLACEMENTS[char] ?? (char >= ' ' && char <= '~' ? char : '?'))
    .join('');
  return ascii.replace(/[\\()]/g, (char) => `\\${char}`);
}

function wrap(text, width = WRAP_AT) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Lays out `{ title, subtitle, sections: [{ heading, text?: string[], code?: string[] }] }`. */
function layout({ title, subtitle, sections }) {
  const pages = [[]];
  let y = PAGE.height - PAGE.margin;
  const add = (style, text, indent = 0) => {
    if (y - style.leading < PAGE.margin + 20) {
      pages.push([]);
      y = PAGE.height - PAGE.margin;
    }
    y -= style.leading;
    pages.at(-1).push({ style, text, x: PAGE.margin + indent, y });
  };

  add(STYLES.title, title);
  if (subtitle) add(STYLES.subtitle, subtitle);
  for (const section of sections) {
    add(STYLES.heading, section.heading);
    for (const paragraph of section.text ?? []) {
      for (const line of wrap(paragraph)) add(STYLES.text, line);
    }
    for (const line of section.code ?? []) add(STYLES.code, line, 12);
  }
  return pages;
}

function contentStream(lines, footer) {
  const ops = lines.map(
    ({ style, text, x, y }) =>
      `BT /${style.font} ${style.size} Tf 1 0 0 1 ${x} ${y} Tm (${toPdfText(text)}) Tj ET`,
  );
  const { font, size } = STYLES.footer;
  ops.push(`BT /${font} ${size} Tf 1 0 0 1 ${PAGE.margin} 32 Tm (${toPdfText(footer)}) Tj ET`);
  return ops.join('\n');
}

/** Returns the PDF as a Buffer. */
export function buildPdf(document) {
  const pages = layout(document);
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length;
  };

  const catalog = addObject(null); // filled in once the page tree exists
  const pageTree = addObject(null);
  const fonts = {
    F1: addObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    ),
    F2: addObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    ),
    F3: addObject(
      '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    ),
  };
  const fontResources = Object.entries(fonts)
    .map(([name, ref]) => `/${name} ${ref} 0 R`)
    .join(' ');

  const pageRefs = pages.map((lines, index) => {
    const footer = `${document.title} - page ${index + 1} of ${pages.length}`;
    const stream = contentStream(lines, footer);
    const contents = addObject(
      `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    );
    return addObject(
      `<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] ` +
        `/Resources << /Font << ${fontResources} >> >> /Contents ${contents} 0 R >>`,
    );
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pageTree} 0 R >>`;
  objects[pageTree - 1] =
    `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(' ')}] /Count ${pageRefs.length} >>`;
  const info = addObject(
    `<< /Title (${toPdfText(document.title)}) /Producer (Training LMS seed) >>`,
  );

  // Byte offsets for the cross-reference table; everything after the header is ASCII.
  const header = Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1');
  const chunks = [header];
  const offsets = [];
  let offset = header.length;
  objects.forEach((body, index) => {
    const chunk = Buffer.from(`${index + 1} 0 obj\n${body}\nendobj\n`, 'latin1');
    offsets.push(offset);
    chunks.push(chunk);
    offset += chunk.length;
  });
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>`,
    'startxref',
    String(offset),
    '%%EOF',
    '',
  ].join('\n');
  chunks.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(chunks);
}
