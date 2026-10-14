import { Router } from 'express';
import * as courses from '../controllers/course.controller.js';
import * as roadmap from '../controllers/roadmap.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/index.js';
import {
  courseStatusSchema,
  createCourseSchema,
  createLessonSchema,
  createModuleSchema,
  idParams,
  listCoursesQuery,
  reorderSchema,
  updateCourseSchema,
  updateLessonSchema,
  updateModuleSchema,
} from '../validators/content.validators.js';

const admin = requireRole(ROLES.ADMIN);
const byId = validate({ params: idParams });

export function courseRoutes() {
  const router = Router();
  router.use(authenticate);

  router.get('/', validate({ query: listCoursesQuery }), courses.list);
  router.post('/', admin, validate({ body: createCourseSchema }), courses.create);
  router.get('/:id', byId, courses.get);
  router.patch(
    '/:id',
    admin,
    validate({ params: idParams, body: updateCourseSchema }),
    courses.update,
  );
  router.delete('/:id', admin, byId, courses.remove);
  router.patch(
    '/:id/status',
    admin,
    validate({ params: idParams, body: courseStatusSchema }),
    courses.setStatus,
  );
  router.get('/:id/roadmap', byId, courses.getRoadmap);
  router.get('/:id/modules', byId, courses.listModules);
  router.post(
    '/:id/modules',
    admin,
    validate({ params: idParams, body: createModuleSchema }),
    courses.createModule,
  );
  router.patch(
    '/:id/modules/reorder',
    admin,
    validate({ params: idParams, body: reorderSchema }),
    courses.reorderModules,
  );
  router.post('/:id/enroll', requireRole(ROLES.STUDENT), byId, courses.enroll);
  return router;
}

export function moduleRoutes() {
  const router = Router();
  router.use(authenticate);

  router.patch(
    '/:id',
    admin,
    validate({ params: idParams, body: updateModuleSchema }),
    roadmap.updateModule,
  );
  router.delete('/:id', admin, byId, roadmap.deleteModule);
  router.get('/:id/lessons', byId, roadmap.listLessons);
  router.post(
    '/:id/lessons',
    admin,
    validate({ params: idParams, body: createLessonSchema }),
    roadmap.createLesson,
  );
  router.patch(
    '/:id/lessons/reorder',
    admin,
    validate({ params: idParams, body: reorderSchema }),
    roadmap.reorderLessons,
  );
  return router;
}

export function lessonRoutes() {
  const router = Router();
  router.use(authenticate);

  router.get('/:id', byId, roadmap.getLesson);
  router.patch(
    '/:id',
    admin,
    validate({ params: idParams, body: updateLessonSchema }),
    roadmap.updateLesson,
  );
  router.delete('/:id', admin, byId, roadmap.deleteLesson);
  return router;
}
