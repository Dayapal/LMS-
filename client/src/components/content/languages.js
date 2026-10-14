import { Prism } from 'prism-react-renderer';
import './prismGlobal.js';
// prism-react-renderer bundles JS/TS/JSX, CSS, SQL, JSON, YAML and markup;
// Java and Bash come from prismjs.
import 'prismjs/components/prism-java.js';
import 'prismjs/components/prism-bash.js';

export { Prism };

/** The languages a code material may use. Mirrors CODE_LANGUAGES on the server. */
export const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'jsx', label: 'JSX (React)' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'tsx', label: 'TSX (React)' },
  { value: 'java', label: 'Java' },
  { value: 'sql', label: 'SQL' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'bash', label: 'Bash / shell' },
  { value: 'text', label: 'Plain text' },
];

const LABELS = Object.fromEntries(CODE_LANGUAGES.map((l) => [l.value, l.label]));

// Fence names people use in Markdown, mapped to Prism grammar names.
const ALIASES = {
  js: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  yml: 'yaml',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
};

/** The Prism grammar for a language name, or null to render plain text. */
export function prismLanguage(language) {
  const name = String(language ?? '').toLowerCase();
  const resolved = ALIASES[name] ?? name;
  return resolved && Prism.languages[resolved] ? resolved : null;
}

export const languageLabel = (language) => LABELS[language] ?? language ?? 'Text';
