// Starts the API side of the end-to-end stack (Playwright's first webServer):
// the in-memory S3 endpoint, a freshly reset `lms_e2e` database seeded with
// demo data, and `node server/src/server.js` in production mode.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { startFakeS3 } from '../../server/tests/fake-s3.js';
import { apiEnv, E2E_DB_URI, FAKE_S3 } from './env.js';

const SERVER_DIR = fileURLToPath(new URL('../../server/', import.meta.url));

function assertThrowawayDatabase(uri) {
  const name = new URL(uri.replace(/^mongodb(\+srv)?:/, 'http:')).pathname.slice(1);
  if (!name.startsWith('lms_e2e')) {
    throw new Error(`Refusing to reset "${name}": the E2E database name must start with lms_e2e`);
  }
  return name;
}

const run = (args, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: SERVER_DIR,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${args[0]} exited ${code}`)),
    );
  });

async function main() {
  const dbName = assertThrowawayDatabase(E2E_DB_URI);
  const s3 = await startFakeS3(FAKE_S3);

  await mongoose.connect(E2E_DB_URI, { serverSelectionTimeoutMS: 5_000 });
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  console.log(`[e2e] reset database ${dbName}; fake S3 on ${s3.endpoint}`);

  const env = apiEnv();
  await run(['src/seeds/seed.js'], env);
  const api = spawn(process.execPath, ['src/server.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  api.on('exit', (code) => {
    console.log(`[e2e] API exited (${code})`);
    process.exit(code ?? 1);
  });
  const stop = () => {
    api.kill();
    s3.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error) => {
  console.error(`[e2e] ${error.message}`);
  process.exit(1);
});
