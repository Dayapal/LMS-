import { lazy, Suspense, useEffect, useRef } from 'react';

const loadCodeEditor = () => import('./CodeEditor.jsx');
const CodeEditor = lazy(loadCodeEditor);

/** A plain textarea stands in while CodeMirror loads, so typing is never blocked. */
function EditorFallback({ value, onChange, onBlur, onFocus, labelledBy, describedBy }) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={onFocus}
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
  // If someone is typing in the stand-in when CodeMirror arrives, focus moves
  // into the editor (cursor at the end) instead of being lost mid-word.
  const typing = useRef(false);

  // Start loading as soon as a form with a code field opens.
  useEffect(() => {
    loadCodeEditor();
  }, []);

  return (
    <Suspense
      fallback={
        <EditorFallback
          {...props}
          onFocus={() => {
            typing.current = true;
          }}
          onBlur={(event) => {
            typing.current = false;
            props.onBlur?.(event);
          }}
        />
      }
    >
      <CodeEditor {...props} takeFocus={typing} />
    </Suspense>
  );
}
