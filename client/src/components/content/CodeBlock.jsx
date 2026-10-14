import { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { languageLabel, Prism, prismLanguage } from './languages.js';

async function copyText(text) {
  if (!navigator.clipboard) throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text);
}

/**
 * Read-only, syntax-highlighted code. Rendered as text tokens (never HTML), so
 * code from any source is safe to display. The scrollable area is focusable
 * so keyboard users can scroll long lines.
 */
export function CodeBlock({ source, language, title, caption, label: labelProp }) {
  const [copied, setCopied] = useState(null); // null | 'done' | 'failed'
  const grammar = prismLanguage(language);
  // `label` names the block for assistive tech when the title is shown elsewhere.
  const label = labelProp ?? title ?? languageLabel(language);

  const copy = async () => {
    try {
      await copyText(source);
      setCopied('done');
    } catch {
      setCopied('failed');
    }
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs">
          {title && <span className="truncate font-medium text-slate-100">{title}</span>}
          <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
            {languageLabel(language)}
          </span>
        </div>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label={`Copy code: ${label}`}
        >
          {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
        <span className="sr-only" role="status">
          {copied === 'done' ? 'Code copied to the clipboard' : ''}
        </span>
      </div>
      <Highlight
        prism={Prism}
        theme={themes.vsDark}
        code={source.replace(/\n$/, '')}
        language={grammar ?? 'text'}
      >
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre
            // A focusable, named region so keyboard users can scroll long lines.
            role="region"
            tabIndex={0}
            aria-label={`Code: ${label}`}
            className="overflow-x-auto px-4 py-3 font-mono text-[13px] leading-6 focus-visible:-outline-offset-2"
          >
            <code>
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {line.map((token, j) => (
                    <span key={j} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
      {caption && (
        <figcaption className="border-t border-slate-800 px-4 py-2 text-xs text-slate-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
