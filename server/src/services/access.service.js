import mongoose from 'mongoose';
import {
  Assignment,
  CONTENT_STATUS,
  Course,
  CourseModule,
  Enrollment,
  ENROLLMENT_STATUS,
  FILE_PURPOSES,
  FileAsset,
  Lesson,
  Material,
  MATERIAL_TYPES,
  ROLES,
  StudyAccess,
  StudyModule,
  Submission,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';

const { trusted } = mongoose;

/**
 * Single source of truth for who may see which course content.
 * Students get 404 (never 403) for anything unpublished or outside their
 * enrollment, so responses don't reveal what exists.
 */

export const isAdmin = (user) => user?.role === ROLES.ADMIN;

const isPublished = (doc) => doc?.status === CONTENT_STATUS.PUBLISHED;
const isArchived = (doc) => doc?.status === CONTENT_STATUS.ARCHIVED;

/** Mongo filter limiting content documents to what `user` may list. */
export const visibleTo = (user) => (isAdmin(user) ? {} : { status: CONTENT_STATUS.PUBLISHED });

export async function getCourseForViewer(user, courseId, notFound = 'Course not found') {
  const course = await Course.findById(courseId);
  if (!course || (!isAdmin(user) && !isPublished(course))) throw ApiError.notFound(notFound);
  return course;
}

export async function getModuleForViewer(user, moduleId) {
  const module = await CourseModule.findById(moduleId);
  if (!module || (!isAdmin(user) && !isPublished(module))) {
    throw ApiError.notFound('Module not found');
  }
  const course = await getCourseForViewer(user, module.course, 'Module not found');
  return { module, course };
}

export async function getActiveEnrollment(userId, courseId) {
  return Enrollment.findOne({ user: userId, course: courseId, status: ENROLLMENT_STATUS.ACTIVE });
}

/**
 * The lesson with its module and course when `user` may open it, otherwise null.
 * Students need the lesson, module and course published and an active
 * enrollment in the course.
 */
async function findLessonForViewer(user, lessonId) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return null;
  if (isAdmin(user)) {
    const [module, course] = await Promise.all([
      CourseModule.findById(lesson.module),
      Course.findById(lesson.course),
    ]);
    return { lesson, module, course };
  }

  const [module, course, enrollment] = await Promise.all([
    CourseModule.findById(lesson.module),
    Course.findById(lesson.course),
    getActiveEnrollment(user._id, lesson.course),
  ]);
  const visible =
    isPublished(lesson) && isPublished(module) && isPublished(course) && Boolean(enrollment);
  return visible ? { lesson, module, course, enrollment } : null;
}

/**
 * Whether every student with an active enrollment in its course can open the
 * lesson: the lesson, its module and its course are published.
 */
export async function lessonOpenToEnrolledStudents(lesson) {
  if (!isPublished(lesson)) return false;
  const [module, course] = await Promise.all([
    CourseModule.findById(lesson.module).select('status').lean(),
    Course.findById(lesson.course).select('status').lean(),
  ]);
  return isPublished(module) && isPublished(course);
}

/** Lesson content (the lesson, its materials and navigation) for `user`, or 404. */
export async function getLessonForViewer(user, lessonId) {
  const found = await findLessonForViewer(user, lessonId);
  if (!found) throw ApiError.notFound('Lesson not found');
  return found;
}

// ---- Assignments and submissions ----

/**
 * The course (and enrollment) through which a student may see `assignment`,
 * or null. The course must be published, the enrollment active, and the
 * module or lesson it belongs to (if any) published too. The assignment must
 * be published, or archived with work from this student: archiving closes an
 * assignment but keeps its history readable (the rules refuse new work).
 */
async function studentAssignmentAccess(user, assignment) {
  const readable =
    isPublished(assignment) ||
    (isArchived(assignment) &&
      Boolean(await Submission.exists({ assignment: assignment._id, student: user._id })));
  if (!readable) return null;

  if (assignment.course) {
    const [course, enrollment, module, lesson] = await Promise.all([
      Course.findById(assignment.course),
      getActiveEnrollment(user._id, assignment.course),
      assignment.module ? CourseModule.findById(assignment.module) : null,
      assignment.lesson ? Lesson.findById(assignment.lesson) : null,
    ]);
    const visible =
      isPublished(course) &&
      Boolean(enrollment) &&
      (!assignment.module || isPublished(module)) &&
      (!assignment.lesson || isPublished(lesson));
    if (visible) return { course, enrollment };
  }

  // Phase 9: Allow access if assignment is linked to a released StudyModule
  const linkedStudyModule = await StudyModule.findOne({
    $or: [{ linkedAssignment: assignment._id }, { _id: assignment.studyModule }],
    status: CONTENT_STATUS.PUBLISHED,
  }).populate('book');

  if (linkedStudyModule && isPublished(linkedStudyModule.book)) {
    const studyAccess = await StudyAccess.findOne({
      student: user._id,
      book: linkedStudyModule.book._id,
      isBookAssigned: true,
    });
    const isReleased = studyAccess?.releasedModules?.some(
      (mId) => mId.toString() === linkedStudyModule._id.toString(),
    );
    if (isReleased) {
      const course = assignment.course ? await Course.findById(assignment.course) : null;
      return { course, studyModule: linkedStudyModule, studyBook: linkedStudyModule.book };
    }
  }

  return null;
}

/** An assignment and its course when `user` may see it, otherwise 404. */
export async function getAssignmentForViewer(user, assignmentId) {
  const assignment = await Assignment.findById(assignmentId);
  if (!assignment) throw ApiError.notFound('Assignment not found');
  if (isAdmin(user)) return { assignment, course: await Course.findById(assignment.course) };
  const access = await studentAssignmentAccess(user, assignment);
  if (!access) throw ApiError.notFound('Assignment not found');
  return { assignment, ...access };
}

/**
 * Mongo filter limiting assignments to the ones `user` may list. For students:
 * assignments of published courses they are actively enrolled in, whose module
 * and lesson (when set) are published, and which are published, or archived
 * with work from this student. Also includes assignments linked to released study modules.
 */
export async function assignmentsVisibleTo(user) {
  if (isAdmin(user)) return {};
  const enrolled = await Enrollment.distinct('course', {
    user: user._id,
    status: ENROLLMENT_STATUS.ACTIVE,
  });
  const courses = await Course.distinct('_id', {
    _id: trusted({ $in: enrolled }),
    status: CONTENT_STATUS.PUBLISHED,
  });
  const [placement, submittedTo, studyAccesses] = await Promise.all([
    publishedPlacement(courses),
    Submission.distinct('assignment', { student: user._id }),
    StudyAccess.find({ student: user._id, isBookAssigned: true }).select('releasedModules'),
  ]);

  const releasedModuleIds = studyAccesses.flatMap((a) => a.releasedModules || []);
  const bookLinkedAssignmentIds =
    releasedModuleIds.length > 0
      ? await StudyModule.distinct('linkedAssignment', {
          _id: trusted({ $in: releasedModuleIds }),
          status: CONTENT_STATUS.PUBLISHED,
          linkedAssignment: { $ne: null },
        })
      : [];

  const courseQuery = {
    course: trusted({ $in: courses }),
    $and: [
      {
        $or: [
          { status: CONTENT_STATUS.PUBLISHED },
          { status: CONTENT_STATUS.ARCHIVED, _id: trusted({ $in: submittedTo }) },
        ],
      },
      ...placement,
    ],
  };

  if (bookLinkedAssignmentIds.length === 0) {
    return courseQuery;
  }

  return {
    $or: [
      courseQuery,
      {
        _id: trusted({ $in: bookLinkedAssignmentIds }),
        $or: [
          { status: CONTENT_STATUS.PUBLISHED },
          { status: CONTENT_STATUS.ARCHIVED, _id: trusted({ $in: submittedTo }) },
        ],
      },
    ],
  };
}

/** Conditions limiting assignments to published modules and lessons (or none) of `courseIds`. */
async function publishedPlacement(courseIds) {
  const inCourses = { course: trusted({ $in: courseIds }), status: CONTENT_STATUS.PUBLISHED };
  const [modules, lessons] = await Promise.all([
    CourseModule.distinct('_id', inCourses),
    Lesson.distinct('_id', inCourses),
  ]);
  return [
    { $or: [{ module: null }, { module: trusted({ $in: modules }) }] },
    { $or: [{ lesson: null }, { lesson: trusted({ $in: lessons }) }] },
  ];
}

/**
 * Mongo filter for the assignments that every student with an active
 * enrollment sees, whether or not they have submitted: published, in a
 * published course, module and lesson. Optionally limited to `courseIds`.
 * Archived assignments are left out: only students who submitted see those,
 * so nobody is ever "missing" work on them. The trainer's counts of expected,
 * pending and overdue work use this, so they agree with what students see.
 */
export async function assignmentsOpenToEnrolledStudents(courseIds) {
  const courses = await Course.distinct('_id', {
    status: CONTENT_STATUS.PUBLISHED,
    ...(courseIds && { _id: trusted({ $in: courseIds }) }),
  });
  return {
    course: trusted({ $in: courses }),
    status: CONTENT_STATUS.PUBLISHED,
    $and: await publishedPlacement(courses),
  };
}

/**
 * A submission when `user` may see it: the trainer sees every submission, a
 * student only their own. Anything else is 404, so ids reveal nothing.
 */
export async function getSubmissionForViewer(user, submissionId) {
  const submission = await Submission.findById(submissionId);
  if (!submission || (!isAdmin(user) && !submission.student.equals(user._id))) {
    throw ApiError.notFound('Submission not found');
  }
  return submission;
}

// ---- Files ----

/**
 * A stored file and whether `user` may download it, or 404.
 * - Material files follow their material: a student needs at least one
 *   published file material that uses it, inside a lesson they can open. The
 *   file is downloadable when any of those materials allows it.
 * - Assignment attachments follow their assignment.
 * - Submission files are visible to the student who uploaded them (and the trainer).
 */
export async function getFileForViewer(user, fileId) {
  const file = await FileAsset.findById(fileId);
  if (!file) throw ApiError.notFound('File not found');
  if (isAdmin(user)) return { file, downloadable: true };

  if (file.purpose === FILE_PURPOSES.MATERIAL) {
    const materials = await Material.find({
      file: file._id,
      type: MATERIAL_TYPES.FILE,
      status: CONTENT_STATUS.PUBLISHED,
    })
      .select('lesson downloadable')
      .lean();
    let visible = false;
    let downloadable = false;
    for (const material of materials) {
      if (!(await findLessonForViewer(user, material.lesson))) continue;
      visible = true;
      downloadable ||= Boolean(material.downloadable);
    }
    if (visible) return { file, downloadable };
  }

  if (file.purpose === FILE_PURPOSES.ASSIGNMENT) {
    const assignments = await Assignment.find({ attachments: file._id });
    for (const assignment of assignments) {
      if (await studentAssignmentAccess(user, assignment)) return { file, downloadable: true };
    }
  }

  if (file.purpose === FILE_PURPOSES.SUBMISSION && file.uploadedBy.equals(user._id)) {
    return { file, downloadable: true };
  }
  throw ApiError.notFound('File not found');
}
