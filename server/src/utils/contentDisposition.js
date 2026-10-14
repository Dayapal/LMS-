const encodeRfc5987 = (value) =>
  encodeURIComponent(value).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * A Content-Disposition header value with an ASCII fallback name and the
 * exact UTF-8 name (RFC 6266 / RFC 5987).
 */
export function contentDisposition(type, filename) {
  const fallback = filename.replace(/[^\x20-\x7e]|["\\%]/g, '_');
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987(filename)}`;
}
