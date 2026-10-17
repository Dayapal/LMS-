import { ACTIVITY_TYPES, Enrollment, ENROLLMENT_STATUS, ROLES, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { paginationMeta, skipFor } from '../utils/pagination.js';
import { getCourseForViewer } from './access.service.js';
import { recordActivity } from './activity.service.js';
import { findCourseOr404 } from './course.service.js';
import { toEnrollmentDTO, toOwnEnrollment } from './serializers.js';

/** A student asks to join a published course; the trainer approves it later. */
export async function requestEnrollment(student, courseId) {
  const course = await getCourseForViewer(student, courseId);
  const existing = await Enrollment.findOne({ user: student._id, course: course._id });

  if (existing?.status === ENROLLMENT_STATUS.ACTIVE) {
    throw ApiError.conflict('You are already enrolled in this course');
  }
  if (existing?.status === ENROLLMENT_STATUS.PENDING) return toOwnEnrollment(existing);

  const enrollment = existing ?? new Enrollment({ user: student._id, course: course._id });
  enrollment.set({
    status: ENROLLMENT_STATUS.PENDING,
    enrolledBy: student._id,
    enrolledAt: undefined,
  });
  await enrollment.save();
  await recordActivity({
    user: student._id,
    type: ACTIVITY_TYPES.ENROLLMENT_REQUESTED,
    course: course._id,
  });
  return toOwnEnrollment(enrollment);
}

const populated = (query) => query.populate('user', 'name email').populate('course', 'title');

export async function listEnrollments({ page, limit, course, status }) {
  const filter = {};
  if (course) filter.course = course;
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    populated(Enrollment.find(filter))
      .sort({ updatedAt: -1 })
      .skip(skipFor({ page, limit }))
      .limit(limit),
    Enrollment.countDocuments(filter),
  ]);
  return { items: items.map(toEnrollmentDTO), meta: paginationMeta({ page, limit }, total) };
}

/** The trainer enrolls a student directly by email, approving any pending request. */
export async function enrollStudent(trainer, { courseId, email }) {
  const course = await findCourseOr404(courseId);
  const student = await User.findOne({ email, role: ROLES.STUDENT });
  if (!student) {
    throw ApiError.validation([{ path: 'email', message: 'No student account uses this email' }]);
  }

  const existing = await Enrollment.findOne({ user: student._id, course: course._id });
  if (existing?.status === ENROLLMENT_STATUS.ACTIVE) {
    throw ApiError.conflict(`${student.name} is already enrolled in this course`);
  }
  const enrollment = existing ?? new Enrollment({ user: student._id, course: course._id });
  enrollment.set({
    status: ENROLLMENT_STATUS.ACTIVE,
    enrolledBy: trainer._id,
    enrolledAt: new Date(),
  });
  await enrollment.save();
  await recordActivity({
    user: student._id,
    actor: trainer._id,
    type: ACTIVITY_TYPES.ENROLLED,
    course: course._id,
  });
  return toEnrollmentDTO(await populated(Enrollment.findById(enrollment._id)));
}

/** Approve (active) or reject/remove (removed) an enrollment. */
export async function updateEnrollmentStatus(trainer, enrollmentId, status) {
  const enrollment = await Enrollment.findById(enrollmentId);
  if (!enrollment) throw ApiError.notFound('Enrollment not found');
  if (enrollment.status !== status) {
    enrollment.status = status;
    enrollment.enrolledBy = trainer._id;
    if (status === ENROLLMENT_STATUS.ACTIVE) enrollment.enrolledAt = new Date();
    await enrollment.save();
    await recordActivity({
      user: enrollment.user,
      actor: trainer._id,
      type:
        status === ENROLLMENT_STATUS.ACTIVE
          ? ACTIVITY_TYPES.ENROLLED
          : ACTIVITY_TYPES.ENROLLMENT_REMOVED,
      course: enrollment.course,
    });
  }
  return toEnrollmentDTO(await populated(Enrollment.findById(enrollment._id)));
}
