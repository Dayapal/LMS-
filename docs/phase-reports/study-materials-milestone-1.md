# Milestone 1 Report: Source Preservation & Study Books Catalogue

**Date:** October 18, 2026  
**Status:** Completed and Verified (Local Milestone 1) — Awaiting User Approval before Milestone 2  
**Target Repository:** `training-lms` (`server/`, `content/study-materials/`)

---

## 1. Summary of Changes in Milestone 1

1. **Source Preservation & Organization:**
   - 27 authoritative HTML books reside untouched in `content/study-materials/` across 3 subject directories:
     - `DSA-Study-Material-in_JS/` (9 files)
     - `JavaScript-All/` (8 files)
     - `ReactjsStudy-Material/` (10 files)
   - `.prettierignore` configured to exclude `content/study-materials`, guaranteeing zero automated reformats.
   - Verified that every single file matches its SHA-256 integrity hash and exact byte count.

2. **Mongoose Database Entities:**
   - **`StudyBook` (`server/src/models/StudyBook.js`):**
     - Schema storing title, slug, category (`dsa` | `javascript` | `react`), description, order, status (`published` | `draft` | `archived`), and Android 16 glassmorphism brand gradient.
   - **`StudyModule` (`server/src/models/StudyModule.js`):**
     - Schema storing book reference, slug, display title, phase label, immutable `originalFilename`, immutable `sourcePath`, immutable `fileHash` (SHA-256), `fileBytes`, `order`, `status`, `prerequisites`, `linkedAssignment`, and `estimatedMinutes`.
   - Both models exported from `server/src/models/index.js`.

3. **Catalogue / Manifest Seed Data:**
   - **`server/src/seeds/data/studyMaterials.js`:** Declarative metadata with cryptographically verified hashes and byte sizes for all 3 books and 27 modules.
   - **`server/src/seeds/studyMaterials.seed.js`:** Idempotent seed function `seedStudyMaterials({ createdBy })` and development reset function `resetStudyMaterials()`.
   - Integrated into `server/src/seeds/seed.js` for seamless developer workflow with `npm run seed` and `npm run seed -- --reset`.

4. **Automated Test Suite:**
   - Created `server/tests/study-materials-integrity.test.js`:
     - Verifies exact 27 HTML files on disk.
     - Computes SHA-256 hashes dynamically and asserts strict byte-for-byte equality against baseline.
     - Verifies database seeding creates 3 books and 27 modules in MongoDB with correct categories and relationships.
     - Verifies duplicate mirror handling (marked draft with explicit warning labels).
     - Verifies re-run idempotence and reset cleanup.

---

## 2. Test Execution Results

- `tests/study-materials-integrity.test.js`: **7 tests passed** (0 failed).
- All 27 file hashes verified against disk.
- Zero source files modified.

---

## 3. Files Created & Modified

### Created Files:
- `content/study-materials/**` (27 original HTML study book files)
- `server/src/models/StudyBook.js` (StudyBook model definition)
- `server/src/models/StudyModule.js` (StudyModule model definition)
- `server/src/seeds/data/studyMaterials.js` (declarative seed metadata with hashes)
- `server/src/seeds/studyMaterials.seed.js` (idempotent seed logic)
- `server/tests/study-materials-integrity.test.js` (file integrity and catalogue tests)
- `docs/phase-reports/study-materials-milestone-1.md` (this report)

### Modified Files:
- `.prettierignore` (added `content/study-materials`)
- `server/src/models/index.js` (exported `StudyBook`, `STUDY_CATEGORIES`, `StudyModule`)
- `server/src/seeds/seed.js` (integrated `seedStudyMaterials` and `resetStudyMaterials`)

