import { useEffect, useState } from 'react';
import { filesApi } from '../api.js';
import { fileKind, formatBytes, isPdf } from '../format.js';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Spinner } from '../../../components/ui/Spinner.jsx';
import { getErrorMessage } from '../../../utils/apiErrors.js';

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Inline PDF viewer. The file is fetched with the signed-in user's token and
 * shown from a local blob: URL, so it never has a public address.
 */
function PdfViewer({ file }) {
  const [state, setState] = useState({ url: null, error: null });

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    filesApi
      .fetch(file.id)
      .then((blob) => {
        if (cancelled) return;
        // Only ever render it as a PDF, whatever the response claimed.
        objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        setState({ url: objectUrl, error: null });
      })
      .catch((error) => !cancelled && setState({ url: null, error }));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.id]);

  if (state.error) return <Alert tone="error">{getErrorMessage(state.error)}</Alert>;
  if (!state.url) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 rounded-lg bg-slate-100 text-sm text-slate-600">
        <Spinner className="size-5" label="Loading PDF" /> Loading PDF…
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <iframe
        src={state.url}
        title={`PDF viewer: ${file.originalName}`}
        className="h-[70vh] min-h-96 w-full rounded-lg border border-slate-200 bg-slate-100"
      />
      <p className="text-xs text-slate-500">
        PDF not showing on your device?{' '}
        <a
          href={state.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-brand-700 hover:text-brand-800"
        >
          Open it in a new tab
        </a>
        .
      </p>
    </div>
  );
}

/** A file material: name, type and size, an inline viewer for PDFs, and a download when allowed. */
export function FileMaterial({ material }) {
  const { file, downloadable } = material;
  const [viewing, setViewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState(null);

  if (!file) return <Alert tone="error">This file is no longer available.</Alert>;

  const download = async () => {
    setDownloading(true);
    setError(null);
    try {
      saveBlob(await filesApi.fetch(file.id, { download: true }), file.originalName);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-700"
        >
          {file.originalName.split('.').pop()?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{file.originalName}</p>
          <p className="text-xs text-slate-500">
            {fileKind(file.mimeType)} · {formatBytes(file.size)}
            {!downloadable && ' · view only'}
          </p>
        </div>
        <div className="flex gap-2">
          {isPdf(file) && (
            <Button
              size="sm"
              variant="secondary"
              aria-expanded={viewing}
              onClick={() => setViewing((v) => !v)}
            >
              {viewing ? 'Hide PDF' : 'View PDF'}
            </Button>
          )}
          {downloadable && (
            <Button size="sm" variant="secondary" loading={downloading} onClick={download}>
              Download
            </Button>
          )}
        </div>
      </div>
      {!isPdf(file) && !downloadable && (
        <p className="text-sm text-slate-500">
          Your trainer has made this file view-only, and this type can&apos;t be previewed in the
          browser.
        </p>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {viewing && <PdfViewer file={file} />}
    </div>
  );
}
