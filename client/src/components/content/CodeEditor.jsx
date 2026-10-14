import { useMemo } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { yaml } from '@codemirror/lang-yaml';

// Bash and plain text are edited without highlighting.
const LANGUAGE_EXTENSIONS = {
  javascript: () => javascript(),
  jsx: () => javascript({ jsx: true }),
  typescript: () => javascript({ typescript: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  java: () => java(),
  sql: () => sql(),
  html: () => html(),
  css: () => css(),
  json: () => json(),
  yaml: () => yaml(),
};

/**
 * CodeMirror editor for trainer code snippets. Loaded lazily (see
 * LazyCodeEditor) so the editor isn't part of the main bundle.
 */
export default function CodeEditor({ value, onChange, onBlur, language, labelledBy, describedBy }) {
  const extensions = useMemo(
    () => [
      ...(LANGUAGE_EXTENSIONS[language] ? [LANGUAGE_EXTENSIONS[language]()] : []),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-labelledby': labelledBy,
        ...(describedBy && { 'aria-describedby': describedBy }),
      }),
    ],
    [language, labelledBy, describedBy],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onBlur={onBlur}
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
