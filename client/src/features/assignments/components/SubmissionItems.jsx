import { CodeBlock } from '../../../components/content/CodeBlock.jsx';
import { FileMaterial } from '../../lessons/components/FileMaterial.jsx';
import { submissionTypeLabel } from '../format.js';

/**
 * What a student handed in: links open in a new tab without sharing the page,
 * PDFs are fetched with the viewer's token, and code is shown as text, never run.
 * `forReviewer` adds the honest status of a student's PDF: its type is checked,
 * but there is no virus scan (spec, Phase 8 known issues).
 */
export function SubmissionItems({ items, forReviewer = false }) {
  return (
    <ul className="space-y-4">
      {items.map((item, index) => (
        <li key={`${item.type}-${index}`} className="space-y-1.5">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {submissionTypeLabel(item.type)}
          </p>
          {item.type === 'pdf' ? (
            <>
              {forReviewer && (
                <p className="text-xs text-slate-600">
                  Checked to be a real PDF, but not scanned for viruses. Open it with the same care
                  as an email attachment.
                </p>
              )}
              <FileMaterial material={{ file: item.file, downloadable: true }} />
            </>
          ) : item.type === 'code' ? (
            item.code.source !== undefined ? (
              <CodeBlock
                source={item.code.source}
                language={item.code.language}
                label={`Submitted code ${index + 1}`}
              />
            ) : (
              <p className="text-sm text-slate-600">{item.code.lines} lines of code</p>
            )
          ) : (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-sm font-medium break-all text-brand-700 hover:text-brand-800 hover:underline"
            >
              {item.url}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
