import mongoose from 'mongoose';
import {
  Assignment,
  CONTENT_STATUS,
  Course,
  CourseModule,
  FILE_PURPOSES,
  FileAsset,
  Lesson,
  STUDENT_ASSIGNMENT_STATUS,
  Submission,
  SUBMISSION_STATUS,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta, skipFor } from '../utils/pagination.js';
import { assignmentsVisibleTo, getAssignmentForViewer, isAdmin } from './access.service.js';
import { deleteFilesIfUnused } from './file.service.js';
import { toAssignmentDTO, toPlacement, toSubmissionDTO } from './serializers.js';
import { latestAttemptStages } from './submissionQueries.js';
import { closesAt, editCheck, newAttemptCheck, studentStatus } from './submissionRules.js';

const { trusted } = mongoose;

const withAttachments = (query) => query.populate('attachments');

const fieldError = (path, message) => ApiError.validation([{ path, message }]);

async function findAssignmentOr404(assignmentId) {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Assignment not found');
  return assignment;
}

/**
 * The module and lesson ids for an assignment of `courseId`. A lesson implies
 * its module; both must belong to the course.
 */
async function resolvePlacement(courseId, { moduleId, lessonId }) {
  if (lessonId) {
    const lesson = await Lesson.findById(lessonId).select('course module');
    if (!lesson?.course.equals(courseId)) {
      throw fieldError('lessonId', 'Choose a lesson from this course');
    }
    if (moduleId && !lesson.module.equals(moduleId)) {
      throw fieldError('lessonId', 'This lesson is not in the chosen module');
    }
    return { module: lesson.module, lesson: lesson._id };
  }
  if (moduleId) {
    const module = await CourseModule.findById(moduleId).select('course');
    if (!module?.course.equals(courseId)) {
      throw fieldError('moduleId', 'Choose a module from this course');
    }
    return { module: module._id, lesson: null };
  }
  return { module: null, lesson: null };
}

/** Assignment handouts uploaded for the same course, in the given order. */
async function resolveAttachments(ids, courseId) {
  if (ids.length === 0) return [];
  const files = await FileAsset.find({ _id: trusted({ $in: ids }) }).select('purpose course');
  const valid = new Set(
    files
      .filter((f) => f.purpose === FILE_PURPOSES.ASSIGNMENT && f.course?.equals(courseId))
      .map((f) => f.id),
  );
  if (ids.some((fileId) => !valid.has(fileId))) {
    throw fieldError('attachmentIds', 'Upload each file for this course before attaching it');
  }
  return ids;
}

/** Late work needs a cutoff after the due date; without late work there is no penalty. */
function normalizeLatePolicy(dueAt, latePolicy) {
  if (!latePolicy.allowLate) return { allowLate: false, lateUntil: null, penaltyPercent: 0 };
  if (!latePolicy.lateUntil) {
    throw fieldError('latePolicy.lateUntil', 'Set the last date late work is accepted');
  }
  if (latePolicy.lateUntil <= dueAt) {
    throw fieldError('latePolicy.lateUntil', 'The late cutoff must be after the due date');
  }
  return latePolicy;
}

// ---- Viewer-specific extras ----

/** Per assignment: students who handed something in, and how many latest attempts await review. */
async function submissionStats(assignmentIds) {
  const rows = await Submission.aggregate([
    ...latestAttemptStages({ assignment: { $in: assignmentIds } }),
    {
      $group: {
        _id: '$_id.assignment',
        students: { $sum: 1 },
        awaitingReview: {
          $sum: { $cond: [{ $eq: ['$latest.status', SUBMISSION_STATUS.SUBMITTED] }, 1, 0] },
        },
      },
    },
  ]);
  return new Map(rows.map((row) => [row._id.toString(), row]));
}

/** The student's latest attempt per assignment. */
async function latestAttempts(student, assignmentIds) {
  const submissions = await Submission.find({
    student: student._id,
    assignment: trusted({ $in: assignmentIds }),
  })
    .sort({ attempt: -1 })
    .select('assignment attempt status isLate submittedAt review')
    .lean();
  const latest = new Map();
  for (const submission of submissions) {
    const key = submission.assignment.toString();
    if (!latest.has(key)) latest.set(key, submission);
  }
  return latest;
}

/** What a student sees about their own progress on an assignment. */
export function toStudentState(assignment, latest, now = new Date()) {
  const create = newAttemptCheck(assignment, latest, now);
  const edit = latest ? editCheck(assignment, latest, latest, now) : { allowed: false };
  return {
    status: studentStatus(assignment, latest, now),
    attempts: latest?.attempt ?? 0,
    latest: latest
      ? {
          id: latest._id.toString(),
          attempt: latest.attempt,
          status: latest.status,
          isLate: Boolean(latest.isLate),
          submittedAt: latest.submittedAt,
          finalMarks: latest.review?.finalMarks ?? null,
          reviewedAt: latest.review?.reviewedAt ?? null,
        }
      : null,
    canSubmit: create.allowed,
    canEdit: edit.allowed,
    // Why a new attempt is refused, when it is and editing isn't possible either.
    blockedReason: create.allowed || edit.allowed ? null : create.reason,
  };
}

const sharedExtras = (assignment) => ({ closesAt: closesAt(assignment) });

async function withViewerExtras(user, assignments) {
  const ids = assignments.map((a) => a._id);
  if (isAdmin(user)) {
    const stats = await submissionStats(ids);
    return assignments.map((assignment) => {
      const row = stats.get(assignment._id.toString());
      return toAssignmentDTO(assignment, {
        ...sharedExtras(assignment),
        stats: { students: row?.students ?? 0, awaitingReview: row?.awaitingReview ?? 0 },
      });
    });
  }
  const latest = await latestAttempts(user, ids);
  const now = new Date();
  return assignments.map((assignment) =>
    toAssignmentDTO(assignment, {
      ...sharedExtras(assignment),
      mySubmission: toStudentState(assignment, latest.get(assignment._id.toString()), now),
    }),
  );
}

// ---- Endpoints ----

export async function listAssignments(user, { page, limit, course, module, lesson, status }) {
  const filter = {};
  if (course) filter.course = course;
  if (module) filter.module = module;
  if (lesson) filter.lesson = lesson;
  if (status && isAdmin(user)) filter.status = status;
  const query = { $and: [await assignmentsVisibleTo(user), filter] };

  const [assignments, total] = await Promise.all([
    withAttachments(
      Assignment.find(query)
        .sort({ dueAt: 1, createdAt: 1 })
        .skip(skipFor({ page, limit }))
        .limit(limit),
    ),
    Assignment.countDocuments(query),
  ]);
  return {
    items: await withViewerExtras(user, assignments),
    meta: paginationMeta({ page, limit }, total),
  };
}

export async function getAssignment(user, assignmentId) {
  const { assignment } = await getAssignmentForViewer(user, assignmentId);
  await assignment.populate([
    'attachments',
    { path: 'course', select: 'title' },
    { path: 'module', select: 'title' },
    { path: 'lesson', select: 'title' },
  ]);
  const [dto] = await withViewerExtras(user, [assignment]);
  return { ...dto, ...toPlacement(assignment) };
}

export async function createAssignment(
  user,
  { courseId, moduleId, lessonId, attachmentIds, ...data },
) {
  const course = await Course.findById(courseId).select('_id');
  if (!course) throw fieldError('courseId', 'Course not found');
  const assignment = await Assignment.create({
    ...data,
    ...(await resolvePlacement(course._id, { moduleId, lessonId })),
    latePolicy: normalizeLatePolicy(data.dueAt, data.latePolicy),
    attachments: await resolveAttachments(attachmentIds, course._id),
    course: course._id,
    createdBy: user._id,
  });
  return getAssignment(user, assignment._id);
}

/**
 * Partial update. The course never changes. Marks already awarded can't
 * exceed a lowered `maxMarks`, and removed attachments are deleted once unused.
 */
export async function updateAssignment(user, assignmentId, data) {
  const assignment = await findAssignmentOr404(assignmentId);
  const { moduleId, lessonId, attachmentIds, latePolicy, ...changes } = data;

  if (moduleId !== undefined || lessonId !== undefined) {
    Object.assign(
      assignment,
      await resolvePlacement(assignment.course, {
        moduleId: moduleId !== undefined ? moduleId : assignment.module?.toString(),
        lessonId: lessonId !== undefined ? lessonId : assignment.lesson?.toString(),
      }),
    );
  }

  if (changes.maxMarks !== undefined && changes.maxMarks < assignment.maxMarks) {
    const above = await Submission.exists({
      assignment: assignment._id,
      'review.marks': trusted({ $gt: changes.maxMarks }),
    });
    if (above) {
      throw fieldError('maxMarks', 'Some submissions already have more marks than this');
    }
  }

  let removedAttachments = [];
  if (attachmentIds !== undefined) {
    const next = await resolveAttachments(attachmentIds, assignment.course);
    removedAttachments = assignment.attachments.filter((f) => !next.includes(f.toString()));
    assignment.attachments = next;
  }

  assignment.set(changes);
  const current = assignment.latePolicy;
  assignment.latePolicy = normalizeLatePolicy(
    assignment.dueAt,
    latePolicy ?? {
      allowLate: current.allowLate,
      lateUntil: current.lateUntil,
      penaltyPercent: current.penaltyPercent,
    },
  );
  await assignment.save();
  await deleteFilesIfUnused(removedAttachments);
  return getAssignment(user, assignment._id);
}

/** Only drafts and archived assignments without any submissions can be deleted. */
export async function deleteAssignment(assignmentId) {
  const assignment = await findAssignmentOr404(assignmentId);
  if (assignment.status === CONTENT_STATUS.PUBLISHED) {
    throw ApiError.conflict(
      'Published assignments cannot be deleted. Move it back to draft or archive it first.',
    );
  }
  if (await Submission.exists({ assignment: assignment._id })) {
    throw ApiError.conflict(
      'Students have already submitted work for this assignment. Archive it instead of deleting.',
    );
  }
  await assignment.deleteOne();
  await deleteFilesIfUnused(assignment.attachments);
}

/** Removes the assignments matching `filter` (which must have no submissions) and their unused files. */
export async function deleteAssignmentsWhere(filter) {
  const assignments = await Assignment.find(filter).select('attachments').lean();
  if (assignments.length === 0) return;
  await Assignment.deleteMany(filter);
  await deleteFilesIfUnused(assignments.flatMap((a) => a.attachments));
}

/** Refuses to delete a module or lesson that assignments still point at. */
export async function assertNoAssignments(filter, label) {
  const count = await Assignment.countDocuments(filter);
  if (count > 0) {
    throw ApiError.conflict(
      `This ${label} has ${count} assignment${count === 1 ? '' : 's'}. Move ${
        count === 1 ? 'it' : 'them'
      } to another part of the course or delete ${count === 1 ? 'it' : 'them'} first.`,
    );
  }
}

// ---- The student's own assignments across courses ----

const titledRef = (ref) => (ref?.title ? { id: ref._id.toString(), title: ref.title } : null);

/**
 * Every assignment the student can see (optionally in one course), due date
 * first, each with their derived state. States come from the server's clock,
 * so "overdue" doesn't depend on the browser's time zone.
 */
export async function myAssignmentRows(student, { course } = {}, now = new Date()) {
  const visible = await assignmentsVisibleTo(student);
  const assignments = await Assignment.find(course ? { $and: [visible, { course }] } : visible)
    .select(
      'course module lesson title dueAt maxMarks maxAttempts latePolicy allowedSubmissionTypes status createdAt',
    )
    .populate([
      { path: 'course', select: 'title' },
      { path: 'module', select: 'title' },
      { path: 'lesson', select: 'title' },
    ])
    .sort({ dueAt: 1, createdAt: 1 })
    .lean();
  const latest = await latestAttempts(
    student,
    assignments.map((a) => a._id),
  );
  return assignments.map((assignment) => ({
    id: assignment._id.toString(),
    title: assignment.title,
    status: assignment.status,
    dueAt: assignment.dueAt,
    closesAt: closesAt(assignment),
    maxMarks: assignment.maxMarks,
    allowedSubmissionTypes: assignment.allowedSubmissionTypes,
    course: titledRef(assignment.course),
    module: titledRef(assignment.module),
    lesson: titledRef(assignment.lesson),
    mySubmission: toStudentState(assignment, latest.get(assignment._id.toString()), now),
  }));
}

/** How many rows are in each derived state, plus `all`. */
export function countStates(rows) {
  const counts = Object.fromEntries(
    Object.values(STUDENT_ASSIGNMENT_STATUS).map((state) => [state, 0]),
  );
  for (const row of rows) counts[row.mySubmission.status] += 1;
  return { all: rows.length, ...counts };
}

/** GET /me/assignments: filtered by derived `status`, paginated, with counts per state. */
export async function listMyAssignments(student, { page, limit, status, course }) {
  const rows = await myAssignmentRows(student, { course });
  const matching = status ? rows.filter((row) => row.mySubmission.status === status) : rows;
  const start = skipFor({ page, limit });
  return {
    items: matching.slice(start, start + limit),
    meta: { ...paginationMeta({ page, limit }, matching.length), counts: countStates(rows) },
  };
}

// ---- Trainer view of an assignment's submissions ----

/**
 * Latest attempt per student, newest first, with the number of attempts.
 * `status` filters on the latest attempt. Code and notes are left out.
 */
export async function listAssignmentSubmissions(assignmentId, { page, limit, status }) {
  const assignment = await findAssignmentOr404(assignmentId);
  const [result] = await Submission.aggregate([
    ...latestAttemptStages({ assignment: assignment._id }),
    ...(status ? [{ $match: { 'latest.status': status } }] : []),
    { $sort: { 'latest.submittedAt': -1, '_id.student': 1 } },
    {
      $facet: {
        items: [{ $skip: skipFor({ page, limit }) }, { $limit: limit }],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  const rows = result.items;
  const latest = await Submission.populate(
    rows.map((row) => Submission.hydrate(row.latest)),
    [{ path: 'student', select: 'name email' }, { path: 'items.file' }],
  );
  return {
    items: latest.map((submission, index) => ({
      ...toSubmissionDTO(submission, { summary: true }),
      attempts: rows[index].attempts,
    })),
    meta: paginationMeta({ page, limit }, result.total[0]?.count ?? 0),
  };
}
