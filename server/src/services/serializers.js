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

export const toFileDTO = (file) => ({
  id: id(file._id),
  originalName: file.originalName,
  mimeType: file.mimeType,
  size: file.size,
  purpose: file.purpose,
  courseId: id(file.course),
  createdAt: file.createdAt,
});

const isPopulatedFile = (file) => Boolean(file && typeof file === 'object' && 'storageKey' in file);

/** A material with only the payload fields of its type. Expects `file` populated. */
export function toMaterialDTO(material) {
  const base = {
    id: id(material._id),
    lessonId: id(material.lesson),
    courseId: id(material.course),
    type: material.type,
    title: material.title,
    order: material.order,
    status: material.status,
    updatedAt: material.updatedAt,
  };
  switch (material.type) {
    case 'note':
      return { ...base, body: material.body ?? '' };
    case 'code':
      return {
        ...base,
        language: material.language,
        source: material.source ?? '',
        caption: material.caption ?? '',
      };
    case 'file':
      return {
        ...base,
        downloadable: Boolean(material.downloadable),
        file: isPopulatedFile(material.file) ? toFileDTO(material.file) : null,
      };
    default:
      return { ...base, url: material.url, description: material.description ?? '' };
  }
}
