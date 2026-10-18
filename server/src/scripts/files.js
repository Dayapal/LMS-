import { parseArgs } from 'node:util';
import { config, redactSecrets } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import '../models/index.js';
import { checkStorage, cleanupFiles, migrateFiles } from '../services/fileMaintenance.js';

const USAGE = `Usage: npm run files -- <command> [options]

  check                         write, read and delete one temporary object in the configured storage
  cleanup [--apply] [--older-than-hours=24]
                                report (and with --apply remove) unattached uploads and stray stored objects
  migrate --to=<local|s3> [--apply]
                                copy files into another provider and point their records at it

Without --apply, cleanup and migrate only report what they would do.`;

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      apply: { type: 'boolean', default: false },
      'older-than-hours': { type: 'string', default: '24' },
      to: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  const [command] = positionals;
  if (values.help || !['check', 'cleanup', 'migrate'].includes(command)) {
    console.log(USAGE);
    return command && !values.help ? 1 : 0;
  }

  if (command === 'check') {
    const result = await checkStorage();
    console.log(`Storage check passed (${result.provider}): ${result.steps.join(', ')}`);
    return 0;
  }

  await connectDatabase(config.mongoUri);
  try {
    if (command === 'cleanup') {
      const olderThanHours = Number(values['older-than-hours']);
      if (!Number.isFinite(olderThanHours) || olderThanHours < 1) {
        throw new Error('--older-than-hours must be at least 1');
      }
      const report = await cleanupFiles({ apply: values.apply, olderThanHours });
      console.log(JSON.stringify(report, null, 2));
      if (!values.apply) console.log('\nDry run: nothing was changed. Add --apply to remove them.');
    } else {
      if (!['local', 's3'].includes(values.to)) throw new Error('--to must be local or s3');
      const report = await migrateFiles({ to: values.to, apply: values.apply });
      console.log(JSON.stringify(report, null, 2));
      if (!values.apply) console.log('\nDry run: nothing was copied. Add --apply to migrate.');
      if (report.problems.length > 0) return 1;
    }
    return 0;
  } finally {
    await disconnectDatabase();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`Failed: ${redactSecrets(error.message)}`);
    process.exit(1);
  });
