import { Router } from 'express';
import * as studyMaterials from '../controllers/studyMaterials.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/index.js';
import { idParams } from '../validators/content.validators.js';
import {
  bulkUpdateStudentAccessSchema,
  updateStudentAccessSchema,
  updateStudyBookSchema,
  updateStudyModuleSchema,
} from '../validators/studyMaterials.validators.js';

const admin = requireRole(ROLES.ADMIN);
const byId = validate({ params: idParams });

export function studyMaterialsRoutes() {
  const router = Router();
  router.use(authenticate);

  // Admin catalogue & publishing management
  router.get('/admin/catalogue', admin, studyMaterials.getAdminCatalogue);
  router.patch(
    '/admin/books/:id',
    admin,
    validate({ params: idParams, body: updateStudyBookSchema }),
    studyMaterials.updateBook,
  );
  router.patch(
    '/admin/modules/:id',
    admin,
    validate({ params: idParams, body: updateStudyModuleSchema }),
    studyMaterials.updateModule,
  );
  router.get('/admin/modules/:id/preview', admin, byId, studyMaterials.getAdminPreview);

  // Admin student access control
  router.get('/admin/access', admin, studyMaterials.getStudentsAccessOverview);
  router.get('/admin/access/:id', admin, byId, studyMaterials.getStudentAccessDetail);
  router.put(
    '/admin/access/:id',
    admin,
    validate({ params: idParams, body: updateStudentAccessSchema }),
    studyMaterials.updateStudentAccess,
  );
  router.post(
    '/admin/access/bulk',
    admin,
    validate({ body: bulkUpdateStudentAccessSchema }),
    studyMaterials.bulkUpdateStudentAccess,
  );

  // Student & viewer library & reader endpoints
  router.get('/', studyMaterials.getStudentBooks);
  router.get('/:bookSlug', studyMaterials.getStudentBookDetail);
  router.get('/:bookSlug/modules/:moduleSlug/content', studyMaterials.getStudentModuleContent);

  return router;
}
