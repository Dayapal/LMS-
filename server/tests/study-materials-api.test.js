import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import { StudyAccess, StudyBook, StudyModule } from '../src/models/index.js';
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
  it('allows admin to list all 3 books and 27 modules in catalogue', async () => {
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
});
