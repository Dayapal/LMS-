import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { StudyAccess, StudyBook, StudyModule, StudyProgress } from '../src/models/index.js';
import { seedStudyMaterials } from '../src/seeds/studyMaterials.seed.js';
import { api, ORIGIN } from './helpers.js';
import { actors, bearer } from './content-helpers.js';

let app;
let admin;
let student;
let otherStudent;

beforeEach(async () => {
  app = createApp();
  ({ admin, student, otherStudent } = await actors());
  await seedStudyMaterials({ createdBy: admin._id });
});

describe('Study Materials API — Admin Catalogue & Publishing', () => {
  it('allows admin to list all 3 books and 34 modules in catalogue', async () => {
    const res = await api(app)
      .get('/api/v1/study-materials/admin/catalogue')
      .set('Origin', ORIGIN)
      .set(bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
    const dsa = res.body.data.find((b) => b.slug === 'dsa-javascript');
    expect(dsa.modules).toHaveLength(9);
    expect(dsa.publishedModules).toBe(9);
    const react = res.body.data.find((b) => b.slug === 'react-js');
    expect(react.modules).toHaveLength(17);
  });

  it('forbids students from accessing admin catalogue', async () => {
    const res = await api(app)
      .get('/api/v1/study-materials/admin/catalogue')
      .set('Origin', ORIGIN)
      .set(bearer(student));

    expect(res.status).toBe(403);
  });

  it('allows admin to toggle module publishing status between draft and published', async () => {
    const dsaMod = await StudyModule.findOne({ slug: 'dsa-module-1' });
    expect(dsaMod.status).toBe('published');

    // Unpublish
    const unpublishRes = await api(app)
      .patch(`/api/v1/study-materials/admin/modules/${dsaMod._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin))
      .send({ status: 'draft' });

    expect(unpublishRes.status).toBe(200);
    const updated = await StudyModule.findById(dsaMod._id);
    expect(updated.status).toBe('draft');

    // Re-publish
    const publishRes = await api(app)
      .patch(`/api/v1/study-materials/admin/modules/${dsaMod._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin))
      .send({ status: 'published' });

    expect(publishRes.status).toBe(200);
    const repub = await StudyModule.findById(dsaMod._id);
    expect(repub.status).toBe('published');
  });

  it('allows admin to preview module content regardless of publication status', async () => {
    const dsaMod = await StudyModule.findOne({ slug: 'dsa-module-1' });
    const res = await api(app)
      .get(`/api/v1/study-materials/admin/modules/${dsaMod._id}/preview`)
      .set('Origin', ORIGIN)
      .set(bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.module.title).toBe(dsaMod.title);
    expect(res.body.data.content).toContain('<!DOCTYPE html>');
    expect(res.body.data.content.length).toBeGreaterThan(1000);
  });
});

describe('Study Materials API — Student Access & Security Enforcement', () => {
  it('enforces that students only see released modules and cannot access unreleased modules', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });
    const mod2 = await StudyModule.findOne({ book: dsaBook._id, order: 2 });

    // Grant Student access only to Module 1
    await StudyAccess.create({
      student: student._id,
      book: dsaBook._id,
      isBookAssigned: true,
      releasedModules: [mod1._id],
    });

    // Student calls content for Module 1 -> 200 OK
    const mod1Res = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(student));

    expect(mod1Res.status).toBe(200);
    expect(mod1Res.body.data.module.title).toBe(mod1.title);
    expect(mod1Res.body.data.content).toContain('<!DOCTYPE html>');

    // Student calls content for Module 2 (unassigned) -> 404 Not Found
    const mod2Res = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod2.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(student));

    expect(mod2Res.status).toBe(404);

    // Other student (no access record) calls Module 1 -> 404 Not Found
    const otherRes = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(otherStudent));

    expect(otherRes.status).toBe(404);
  });

  it('forbids students from accessing draft/unpublished modules even if assigned', async () => {
    const jsBook = await StudyBook.findOne({ slug: 'javascript' });
    const draftMod = await StudyModule.findOne({ book: jsBook._id, slug: 'js-phase-2-mirror' });
    expect(draftMod.status).toBe('draft');

    // Assign draft module to student
    await StudyAccess.create({
      student: student._id,
      book: jsBook._id,
      isBookAssigned: true,
      releasedModules: [draftMod._id],
    });

    // Attempt to access content
    const res = await api(app)
      .get(`/api/v1/study-materials/javascript/modules/${draftMod.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(student));

    expect(res.status).toBe(404);
  });

  describe('Telemetry, Reading Progress & Dashboard Summary (Milestone 4 & 5)', () => {
    it('records reading duration heartbeat and updates scroll position', async () => {
      const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
      const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

      // Grant access
      await StudyAccess.create({
        student: student._id,
        book: dsaBook._id,
        isBookAssigned: true,
        releasedModules: [mod1._id],
      });

      // First heartbeat
      const hb1 = await api(app)
        .post(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/heartbeat`)
        .set('Origin', ORIGIN)
        .set(bearer(student))
        .send({ activeSeconds: 30, scrollPosition: 45 });

      expect(hb1.status).toBe(200);
      expect(hb1.body.data.totalReadingSeconds).toBe(30);
      expect(hb1.body.data.lastScrollPosition).toBe(45);
      expect(hb1.body.data.isCompleted).toBe(false);

      // Second heartbeat accumulates
      const hb2 = await api(app)
        .post(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/heartbeat`)
        .set('Origin', ORIGIN)
        .set(bearer(student))
        .send({ activeSeconds: 25, scrollPosition: 75 });

      expect(hb2.status).toBe(200);
      expect(hb2.body.data.totalReadingSeconds).toBe(55);
      expect(hb2.body.data.lastScrollPosition).toBe(75);

      // Verify in DB
      const dbProgress = await StudyProgress.findOne({ student: student._id, module: mod1._id });
      expect(dbProgress.totalReadingSeconds).toBe(55);
      expect(dbProgress.lastScrollPosition).toBe(75);
    });

    it('marks module complete, logs activity, and unmarks complete', async () => {
      const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
      const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

      await StudyAccess.create({
        student: student._id,
        book: dsaBook._id,
        isBookAssigned: true,
        releasedModules: [mod1._id],
      });

      // Mark complete
      const markRes = await api(app)
        .post(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/complete`)
        .set('Origin', ORIGIN)
        .set(bearer(student));

      expect(markRes.status).toBe(200);
      expect(markRes.body.data.isCompleted).toBe(true);
      expect(markRes.body.data.completedAt).toBeTruthy();

      // Check book detail reflects completion
      const bookRes = await api(app)
        .get('/api/v1/study-materials/dsa-javascript')
        .set('Origin', ORIGIN)
        .set(bearer(student));

      expect(bookRes.status).toBe(200);
      expect(bookRes.body.data.completedCount).toBe(1);
      expect(bookRes.body.data.overallPercent).toBe(100); // 1 completed of 1 released

      // Unmark complete
      const unmarkRes = await api(app)
        .delete(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/complete`)
        .set('Origin', ORIGIN)
        .set(bearer(student));

      expect(unmarkRes.status).toBe(200);
      expect(unmarkRes.body.data.isCompleted).toBe(false);
      expect(unmarkRes.body.data.completedAt).toBeNull();
    });

    it('returns study summary for student dashboard', async () => {
      const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
      const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

      await StudyAccess.create({
        student: student._id,
        book: dsaBook._id,
        isBookAssigned: true,
        releasedModules: [mod1._id],
      });

      const summaryRes = await api(app)
        .get('/api/v1/study-materials/summary')
        .set('Origin', ORIGIN)
        .set(bearer(student));

      expect(summaryRes.status).toBe(200);
      expect(summaryRes.body.data.totalAssignedBooks).toBe(1);
      expect(summaryRes.body.data.totalReleasedModules).toBe(1);
      expect(summaryRes.body.data.totalCompletedModules).toBe(0);
      expect(summaryRes.body.data.books).toHaveLength(3);
    });

    it('forbids unreleased modules from receiving heartbeats or completions', async () => {
      const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
      const mod2 = await StudyModule.findOne({ book: dsaBook._id, order: 2 });

      // Student has no access to mod2
      const hbRes = await api(app)
        .post(`/api/v1/study-materials/dsa-javascript/modules/${mod2.slug}/heartbeat`)
        .set('Origin', ORIGIN)
        .set(bearer(student))
        .send({ activeSeconds: 15 });

      expect(hbRes.status).toBe(404);

      const compRes = await api(app)
        .post(`/api/v1/study-materials/dsa-javascript/modules/${mod2.slug}/complete`)
        .set('Origin', ORIGIN)
        .set(bearer(student));

      expect(compRes.status).toBe(404);
    });
  });

  describe('Admin Reports & Visibility Permission Controls (Milestone 6)', () => {
    it('allows admin to view reports and export CSV, but forbids students', async () => {
      // Admin reads reports
      const adminRes = await api(app)
        .get('/api/v1/study-materials/admin/reports')
        .set('Origin', ORIGIN)
        .set(bearer(admin));

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.data.rows).toBeInstanceOf(Array);

      // Student gets 403 Forbidden
      const studentRes = await api(app)
        .get('/api/v1/study-materials/admin/reports')
        .set('Origin', ORIGIN)
        .set(bearer(student));

      expect(studentRes.status).toBe(403);

      // Admin exports CSV
      const csvRes = await api(app)
        .get('/api/v1/study-materials/admin/reports/export')
        .set('Origin', ORIGIN)
        .set(bearer(admin));

      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain('Student Name,Student Email');
    });

    it('enforces student report visibility toggle without affecting reading access', async () => {
      const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
      const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

      // Grant access with report visibility enabled
      const access = await StudyAccess.create({
        student: student._id,
        book: dsaBook._id,
        isBookAssigned: true,
        releasedModules: [mod1._id],
        canViewReport: true,
      });

      // Student can view report
      const rep1 = await api(app)
        .get('/api/v1/study-materials/my-report')
        .set('Origin', ORIGIN)
        .set(bearer(student));

      expect(rep1.status).toBe(200);
      expect(rep1.body.data.student.email).toBe(student.email);

      // Trainer disables report visibility
      access.canViewReport = false;
      await access.save();

      // Student receives 403 Forbidden
      const rep2 = await api(app)
        .get('/api/v1/study-materials/my-report')
        .set('Origin', ORIGIN)
        .set(bearer(student));

      expect(rep2.status).toBe(403);
      expect(rep2.body.error.message).toContain('disabled');

      // However, reading access is still functional!
      const contentRes = await api(app)
        .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
        .set('Origin', ORIGIN)
        .set(bearer(student));

      expect(contentRes.status).toBe(200);
    });
  });
});

