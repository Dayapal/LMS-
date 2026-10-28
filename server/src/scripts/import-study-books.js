#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config/env.js';
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { importStudyBooks } from '../services/studyBookImport.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const pathArg = args.find((a) => !a.startsWith('--'));

  if (!pathArg) {
    console.error(`Usage: node import-study-books.js <archive.zip|source-folder> [--dry-run] [--force]`);
    process.exit(1);
  }

  const resolvedTarget = path.resolve(process.cwd(), pathArg);
  const isZip = resolvedTarget.toLowerCase().endsWith('.zip');

  console.log(`\n📚 Phase 9 Study Book Import Process`);
  console.log(`Target: ${resolvedTarget}`);
  console.log(`Type: ${isZip ? 'ZIP Archive' : 'Directory'}`);
  console.log(`Dry Run: ${dryRun ? 'YES (No files or DB records will be written)' : 'NO'}`);
  console.log(`Force Overwrite: ${force ? 'YES' : 'NO'}\n`);

  let dbConnected = false;
  if (!dryRun) {
    try {
      await connectDatabase(config.database.uri);
      dbConnected = true;
    } catch (err) {
      console.warn(`[WARN] MongoDB not available (${err.message}). Only filesystem import will run.`);
    }
  }

  try {
    const report = await importStudyBooks({
      archivePath: isZip ? resolvedTarget : null,
      directoryPath: !isZip ? resolvedTarget : null,
      dryRun,
      force,
    });

    console.log(`\n================ IMPORT REPORT ================`);
    console.log(`Success: ${report.success}`);
    console.log(`Books Identified: ${report.booksCount}`);
    console.log(`Total HTML Modules: ${report.htmlCount}`);
    console.log(`Total Uncompressed Bytes: ${(report.totalBytes / (1024 * 1024)).toFixed(2)} MB`);

    for (const b of report.books) {
      console.log(`\n📖 [${b.category.toUpperCase()}] ${b.title} (${b.slug})`);
      console.log(`   Modules: ${b.modulesCount} (Published: ${b.publishedCount}, Mirrors: ${b.duplicateCount})`);
      for (const m of b.modules) {
        console.log(`   - ${m.phaseLabel || 'Module'}: ${m.title} [${m.originalFilename}] (${(m.bytes / 1024).toFixed(0)} KB) ${m.isDuplicate ? '(Mirror: DRAFT)' : ''}`);
      }
    }

    if (report.warnings.length > 0) {
      console.log(`\n⚠️ Warnings (${report.warnings.length}):`);
      report.warnings.forEach((w) => console.log(`   - ${w}`));
    }

    if (report.errors.length > 0) {
      console.log(`\n❌ Errors (${report.errors.length}):`);
      report.errors.forEach((e) => console.log(`   - ${e}`));
    }
    console.log(`===============================================\n`);
  } catch (err) {
    console.error(`\n❌ Import failed: ${err.message}\n`);
    process.exitCode = 1;
  } finally {
    if (dbConnected) {
      await disconnectDatabase();
    }
  }
}

main();
