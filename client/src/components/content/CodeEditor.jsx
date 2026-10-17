import { useEffect, useMemo, useState } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';

// Each grammar is its own chunk, fetched the first time an editor needs it,
// so the editor itself stays small. Bash and plain text have no highlighting.
const LANGUAGE_LOADERS = {
  javascript: () => import('@codemirror/lang-javascript').then((m) => m.javascript()),
  jsx: () => import('@codemirror/lang-javascript').then((m) => m.javascript({ jsx: true })),
  typescript: () =>
    import('@codemirror/lang-javascript').then((m) => m.javascript({ typescript: true })),
  tsx: () =>
    import('@codemirror/lang-javascript').then((m) =>
      m.javascript({ jsx: true, typescript: true }),
    ),
  java: () => import('@codemirror/lang-java').then((m) => m.java()),
  sql: () => import('@codemirror/lang-sql').then((m) => m.sql()),
  html: () => import('@codemirror/lang-html').then((m) => m.html()),
  css: () => import('@codemirror/lang-css').then((m) => m.css()),
  json: () => import('@codemirror/lang-json').then((m) => m.json()),
  yaml: () => import('@codemirror/lang-yaml').then((m) => m.yaml()),
};

/** The grammar extension for `language`, or null until it has loaded (or if there is none). */
function useLanguageExtension(language) {
  const [loaded, setLoaded] = useState({ language: null, extension: null });
  useEffect(() => {
    const load = LANGUAGE_LOADERS[language];
    if (!load) return undefined;
    let cancelled = false;
    load()
      .then((extension) => !cancelled && setLoaded({ language, extension }))
      // Without the grammar the editor still works, just without colours.
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [language]);
  return loaded.language === language ? loaded.extension : null;
}

/**
 * CodeMirror editor for trainer code snippets. Loaded lazily (see
 * LazyCodeEditor) so the editor isn't part of the main bundle.
 */
export default function CodeEditor({
  value,
  onChange,
  onBlur,
  language,
  labelledBy,
  describedBy,
  takeFocus,
}) {
  const languageExtension = useLanguageExtension(language);
  const extensions = useMemo(
    () => [
      ...(languageExtension ? [languageExtension] : []),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-labelledby': labelledBy,
        ...(describedBy && { 'aria-describedby': describedBy }),
      }),
    ],
    [languageExtension, labelledBy, describedBy],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onCreateEditor={(view) => {
        // Replacing the stand-in textarea while it had focus (see LazyCodeEditor).
        if (!takeFocus?.current) return;
        view.focus();
        view.dispatch({ selection: { anchor: view.state.doc.length } });
      }}
      extensions={extensions}
      // Tab moves focus as in any form field (no keyboard trap), and Escape is
      // left to the surrounding dialog. Enter keeps the current indentation.
      indentWithTab={false}
      theme="dark"
      minHeight="220px"
      maxHeight="420px"
      basicSetup={{ foldGutter: false, autocompletion: false }}
      className="overflow-hidden rounded-lg border border-slate-300 text-[13px]"
    />
  );
}
