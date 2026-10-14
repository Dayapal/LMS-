import { lazy, Suspense } from 'react';

const CodeEditor = lazy(() => import('./CodeEditor.jsx'));

/** A plain textarea stands in while CodeMirror loads, so typing is never blocked. */
function EditorFallback({ value, onChange, onBlur, labelledBy, describedBy }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      rows={10}
      spellCheck={false}
      className="block w-full rounded-lg border border-slate-300 bg-slate-950 px-3 py-2 font-mono text-[13px] text-slate-100"
    />
  );
}

export function LazyCodeEditor(props) {
  return (
    <Suspense fallback={<EditorFallback {...props} />}>
      <CodeEditor {...props} />
    </Suspense>
  );
}
