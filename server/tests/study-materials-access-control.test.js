import { describe, it, expect, beforeEach } from 'vitest';
import { createApp } from '../src/app.js';
import {
  Activity,
  ACTIVITY_TYPES,
  Assignment,
  CONTENT_STATUS,
  Course,
  StudyAccess,
  StudyBook,
  StudyModule,
  StudyProgress,
  SUBMISSION_TYPES,
} from '../src/models/index.js';
import { seedStudyMaterials } from '../src/seeds/studyMaterials.seed.js';
import { api, ORIGIN } from './helpers.js';
import { actors, bearer } from './content-helpers.js';

let app;
let admin;
let studentA;
let studentB;

beforeEach(async () => {
  app = createApp();
  const act = await actors();
  admin = act.admin;
  studentA = act.student;
  studentB = act.otherStudent;
  await seedStudyMaterials({ createdBy: admin._id });
});

describe('Phase 9: Individual Student Access & Phase Release Rules', () => {
  it('forbids unassigned students from opening book content (404)', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

    const res = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));

    expect(res.status).toBe(404);
  });

  it('keeps Student A and Student B completely isolated', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const jsBook = await StudyBook.findOne({ slug: 'javascript' });
    const dsaMod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });
    const jsMod1 = await StudyModule.findOne({ book: jsBook._id, order: 1 });

    // Grant Student A only DSA Module 1
    await StudyAccess.create({
      student: studentA._id,
      book: dsaBook._id,
      isBookAssigned: true,
      releasedModules: [dsaMod1._id],
    });

    // Grant Student B only JavaScript Module 1
    await StudyAccess.create({
      student: studentB._id,
      book: jsBook._id,
      isBookAssigned: true,
      releasedModules: [jsMod1._id],
    });

    // Student A can access DSA Module 1
    const aDsa = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${dsaMod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(aDsa.status).toBe(200);

    // Student A CANNOT access JavaScript Module 1
    const aJs = await api(app)
      .get(`/api/v1/study-materials/javascript/modules/${jsMod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(aJs.status).toBe(404);

    // Student B CANNOT access DSA Module 1
    const bDsa = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${dsaMod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentB));
    expect(bDsa.status).toBe(404);

    // Student B can access JavaScript Module 1
    const bJs = await api(app)
      .get(`/api/v1/study-materials/javascript/modules/${jsMod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentB));
    expect(bJs.status).toBe(200);
  });

  it('enforces sequential phase release via action: release_next', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });
    const mod2 = await StudyModule.findOne({ book: dsaBook._id, order: 2 });
    const mod3 = await StudyModule.findOne({ book: dsaBook._id, order: 3 });

    // Initially grant only Module 1
    await StudyAccess.create({
      student: studentA._id,
      book: dsaBook._id,
      isBookAssigned: true,
      releasedModules: [mod1._id],
    });

    // Module 2 is locked
    const m2Pre = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod2.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(m2Pre.status).toBe(404);

    // Admin triggers "release_next"
    const releaseRes = await api(app)
      .put(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin))
      .send({
        bookId: dsaBook._id.toString(),
        action: 'release_next',
      });

    expect(releaseRes.status).toBe(200);

    // Module 2 is now accessible!
    const m2Post = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod2.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(m2Post.status).toBe(200);

    // Module 3 is still locked
    const m3 = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod3.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(m3.status).toBe(404);

    // Activity was logged for the trainer's release
    const logged = await Activity.findOne({
      user: studentA._id,
      actor: admin._id,
      type: ACTIVITY_TYPES.STUDY_ACCESS_UPDATED,
    });
    expect(logged).not.toBeNull();
  });

  it('revoking a phase locks content immediately while preserving progress history', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

    // Grant access
    const access = await StudyAccess.create({
      student: studentA._id,
      book: dsaBook._id,
      isBookAssigned: true,
      releasedModules: [mod1._id],
    });

    // Student reads and completes module
    await StudyProgress.create({
      student: studentA._id,
      book: dsaBook._id,
      module: mod1._id,
      totalReadingSeconds: 450,
      isCompleted: true,
      completedAt: new Date(),
    });

    // Revoke module from student
    access.releasedModules = [];
    await access.save();

    // Content access returns 404 immediately
    const res = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(res.status).toBe(404);

    // Progress record is NOT deleted
    const preservedProgress = await StudyProgress.findOne({
      student: studentA._id,
      module: mod1._id,
    });
    expect(preservedProgress).not.toBeNull();
    expect(preservedProgress.isCompleted).toBe(true);
    expect(preservedProgress.totalReadingSeconds).toBe(450);

    // When re-released, progress remains intact
    access.releasedModules = [mod1._id];
    await access.save();

    const reopened = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(reopened.status).toBe(200);
    expect(reopened.body.data.readingProgress.isCompleted).toBe(true);
    expect(reopened.body.data.readingProgress.totalReadingSeconds).toBe(450);
  });

  it('revoking entire book blocks all modules while preserving history', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

    const access = await StudyAccess.create({
      student: studentA._id,
      book: dsaBook._id,
      isBookAssigned: true,
      releasedModules: [mod1._id],
    });

    // Revoke book assignment
    access.isBookAssigned = false;
    await access.save();

    const res = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(res.status).toBe(404);

    const roadmap = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(roadmap.status).toBe(404);
  });

  it('integrates linked assignments with study phase release rules', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

    // Create a base course (required for Assignment schema)
    const course = await Course.create({
      title: 'DSA Course',
      slug: 'dsa-course',
      description: 'DSA course',
      level: 'beginner',
      status: CONTENT_STATUS.PUBLISHED,
      createdBy: admin._id,
    });

    // Create an assignment linked to DSA Module 1
    const assignment = await Assignment.create({
      course: course._id,
      studyBook: dsaBook._id,
      studyModule: mod1._id,
      title: 'DSA Module 1 Homework',
      instructions: 'Complete recursion exercises',
      dueAt: new Date(Date.now() + 86400000),
      maxMarks: 100,
      allowedSubmissionTypes: [SUBMISSION_TYPES.PROJECT_URL],
      status: CONTENT_STATUS.PUBLISHED,
      createdBy: admin._id,
    });

    // Link assignment to StudyModule
    mod1.linkedAssignment = assignment._id;
    await mod1.save();

    // Student A is NOT enrolled in course and has NOT been released Module 1 -> 404
    const preRes = await api(app)
      .get(`/api/v1/assignments/${assignment._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(preRes.status).toBe(404);

    // Release Module 1 to Student A (WITHOUT course enrollment!)
    await StudyAccess.create({
      student: studentA._id,
      book: dsaBook._id,
      isBookAssigned: true,
      releasedModules: [mod1._id],
    });

    // Now Student A CAN view the assignment!
    const postRes = await api(app)
      .get(`/api/v1/assignments/${assignment._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(postRes.status).toBe(200);
    expect(postRes.body.data.title).toBe('DSA Module 1 Homework');

    // And Student A can submit to it!
    const subRes = await api(app)
      .post(`/api/v1/assignments/${assignment._id}/submissions`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA))
      .send({
        items: [{ type: SUBMISSION_TYPES.PROJECT_URL, url: 'https://example.com/dsa-hw' }],
      });
    expect(subRes.status).toBe(201);
  });

  it('admin student access detail endpoint returns progress and nextUnreleasedModule', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

    await StudyAccess.create({
      student: studentA._id,
      book: dsaBook._id,
      isBookAssigned: true,
      releasedModules: [mod1._id],
      canViewReport: false,
      grantedBy: admin._id,
    });

    const res = await api(app)
      .get(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin));

    expect(res.status).toBe(200);
    expect(res.body.data.student.id).toBe(studentA._id.toString());
    const dsa = res.body.data.books.find((b) => b.slug === 'dsa-javascript');
    expect(dsa.isAssigned).toBe(true);
    expect(dsa.accessStatus).toBe('partially_released');
    expect(dsa.canViewReport).toBe(false);
    expect(dsa.grantedBy.name).toBe(admin.name);
    expect(dsa.progress.releasedCount).toBe(1);
    expect(dsa.nextUnreleasedModule.order).toBe(2);
  });

  it('allows granting with scope: "selected" to release only specific phases', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });
    const mod2 = await StudyModule.findOne({ book: dsaBook._id, order: 2 });
    const mod3 = await StudyModule.findOne({ book: dsaBook._id, order: 3 });

    // Grant Student A only modules 1 and 3
    const res = await api(app)
      .put(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin))
      .send({
        bookId: dsaBook._id.toString(),
        scope: 'selected',
        releasedModuleIds: [mod1._id.toString(), mod3._id.toString()],
        canViewReport: true,
      });

    expect(res.status).toBe(200);

    // Module 1 is accessible
    const m1Res = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(m1Res.status).toBe(200);

    // Module 2 is NOT accessible (404)
    const m2Res = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod2.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(m2Res.status).toBe(404);

    // Module 3 is accessible
    const m3Res = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod3.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(m3Res.status).toBe(200);
  });

  it('revoking book access blocks content immediately and restoring preserves earlier progress', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });
    const mod1 = await StudyModule.findOne({ book: dsaBook._id, order: 1 });

    // Grant access
    await api(app)
      .put(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin))
      .send({
        bookId: dsaBook._id.toString(),
        scope: 'selected',
        releasedModuleIds: [mod1._id.toString()],
      });

    // Record reading progress and mark complete
    await StudyProgress.create({
      student: studentA._id,
      book: dsaBook._id,
      module: mod1._id,
      isCompleted: true,
      totalReadingSeconds: 650,
      completedAt: new Date(),
    });

    // Student can open content
    const preRevoke = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(preRevoke.status).toBe(200);

    // Trainer revokes book access
    const revokeRes = await api(app)
      .put(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin))
      .send({
        bookId: dsaBook._id.toString(),
        isBookAssigned: false,
      });
    expect(revokeRes.status).toBe(200);

    // Access detail reflects status: 'revoked'
    const detailRes = await api(app)
      .get(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin));
    const dsaDetail = detailRes.body.data.books.find((b) => b.slug === 'dsa-javascript');
    expect(dsaDetail.isAssigned).toBe(false);
    expect(dsaDetail.accessStatus).toBe('revoked');
    expect(dsaDetail.revokedAt).toBeTruthy();

    // Content is now blocked with 404
    const duringRevoke = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(duringRevoke.status).toBe(404);

    // Trainer restores book access
    const restoreRes = await api(app)
      .put(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin))
      .send({
        bookId: dsaBook._id.toString(),
        action: 'restore',
      });
    expect(restoreRes.status).toBe(200);

    // Content is accessible again
    const postRestore = await api(app)
      .get(`/api/v1/study-materials/dsa-javascript/modules/${mod1.slug}/content`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA));
    expect(postRestore.status).toBe(200);

    // Previous progress is intact!
    const restoredDetail = await api(app)
      .get(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin));
    const dsaRestored = restoredDetail.body.data.books.find((b) => b.slug === 'dsa-javascript');
    expect(dsaRestored.isAssigned).toBe(true);
    expect(dsaRestored.progress.completedCount).toBe(1);
    expect(dsaRestored.progress.totalReadingSeconds).toBe(650);
  });

  it('rejects unauthorized access management and enforces uniqueness', async () => {
    const dsaBook = await StudyBook.findOne({ slug: 'dsa-javascript' });

    // Unauthenticated caller -> 401
    const unauth = await api(app)
      .put(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .send({ bookId: dsaBook._id.toString(), isBookAssigned: true });
    expect(unauth.status).toBe(401);

    // Student caller attempting to modify access -> 403
    const forbidden = await api(app)
      .put(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(studentA))
      .send({ bookId: dsaBook._id.toString(), isBookAssigned: true });
    expect(forbidden.status).toBe(403);

    // Repeated grant calls are idempotent and never produce duplicate records
    await api(app)
      .put(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin))
      .send({ bookId: dsaBook._id.toString(), isBookAssigned: true });

    await api(app)
      .put(`/api/v1/study-materials/admin/access/${studentA._id}`)
      .set('Origin', ORIGIN)
      .set(bearer(admin))
      .send({ bookId: dsaBook._id.toString(), isBookAssigned: true });

    const count = await StudyAccess.countDocuments({
      student: studentA._id,
      book: dsaBook._id,
    });
    expect(count).toBe(1);
  });
});
