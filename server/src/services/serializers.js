const id = (value) => value?.toString() ?? null;

export const toCourseDTO = (course, extra = {}) => ({
  id: id(course._id),
  title: course.title,
  slug: course.slug,
  summary: course.summary ?? '',
  description: course.description ?? '',
  thumbnailUrl: course.thumbnailUrl ?? null,
  level: course.level,
  estimatedHours: course.estimatedHours ?? 0,
  status: course.status,
  tags: course.tags ?? [],
  createdAt: course.createdAt,
  updatedAt: course.updatedAt,
  ...extra,
});

export const toModuleDTO = (module, extra = {}) => ({
  id: id(module._id),
  courseId: id(module.course),
  title: module.title,
  description: module.description ?? '',
  order: module.order,
  status: module.status,
  ...extra,
});

export const toLessonDTO = (lesson) => ({
  id: id(lesson._id),
  courseId: id(lesson.course),
  moduleId: id(lesson.module),
  title: lesson.title,
  slug: lesson.slug,
  summary: lesson.summary ?? '',
  objectives: lesson.objectives ?? [],
  prerequisites: lesson.prerequisites ?? [],
  estimatedMinutes: lesson.estimatedMinutes ?? 0,
  order: lesson.order,
  status: lesson.status,
});

export const toEnrollmentDTO = (enrollment) => ({
  id: id(enrollment._id),
  status: enrollment.status,
  enrolledAt: enrollment.enrolledAt ?? null,
  createdAt: enrollment.createdAt,
  updatedAt: enrollment.updatedAt,
  user:
    enrollment.user && typeof enrollment.user === 'object' && 'email' in enrollment.user
      ? { id: id(enrollment.user._id), name: enrollment.user.name, email: enrollment.user.email }
      : { id: id(enrollment.user) },
  course:
    enrollment.course && typeof enrollment.course === 'object' && 'title' in enrollment.course
      ? { id: id(enrollment.course._id), title: enrollment.course.title }
      : { id: id(enrollment.course) },
});

/** The viewer's own enrollment summary embedded in course responses. */
export const toOwnEnrollment = (enrollment) =>
  enrollment ? { status: enrollment.status, enrolledAt: enrollment.enrolledAt ?? null } : null;
