// Runs after `vite build`: fails the build if the proxy secret (ORIGIN_SECRET on
// Vercel, PROXY_ORIGIN_SECRET for the local preview proxy) appears anywhere in
// the files that would be served to browsers. Vite only exposes VITE_* variables,
// so this is a guard against mistakes, not the protection itself.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SECRET_VARIABLES = ['ORIGIN_SECRET', 'PROXY_ORIGIN_SECRET', 'ORIGIN_SECRET_PREVIOUS'];

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

/** Names of the files (relative to `dir`) that contain any of `secrets`. */
export function filesContainingSecrets(dir, secrets) {
  const values = secrets.filter((value) => value && value.length >= 8);
  if (values.length === 0) return [];
  return listFiles(dir)
    .filter((file) => {
      const content = readFileSync(file);
      return values.some((value) => content.includes(value));
    })
    .map((file) => path.relative(dir, file).replaceAll('\\', '/'));
}

function main() {
  const dist = fileURLToPath(new URL('../dist', import.meta.url));
  const leaked = filesContainingSecrets(
    dist,
    SECRET_VARIABLES.map((name) => process.env[name]),
  );
  if (leaked.length > 0) {
    console.error(`The proxy secret appears in the client build: ${leaked.join(', ')}`);
    process.exit(1);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
