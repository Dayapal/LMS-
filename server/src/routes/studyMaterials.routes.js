import { Router } from 'express';
import * as studyMaterials from '../controllers/studyMaterials.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/index.js';
import { idParams } from '../validators/content.validators.js';
import {
  bulkUpdateStudentAccessSchema,
  heartbeatSchema,
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

  // Admin study reports & CSV export
  router.get('/admin/reports', admin, studyMaterials.getAdminReports);
  router.get('/admin/reports/export', admin, studyMaterials.exportAdminReportsCsv);

  // Student & viewer library, reader, telemetry & completion endpoints
  router.get('/', studyMaterials.getStudentBooks);
  router.get('/summary', studyMaterials.getStudentStudySummary);
  router.get('/my-report', studyMaterials.getMyReport);
  router.get('/:bookSlug', studyMaterials.getStudentBookDetail);
  router.get('/:bookSlug/modules/:moduleSlug/content', studyMaterials.getStudentModuleContent);
  router.post(
    '/:bookSlug/modules/:moduleSlug/heartbeat',
    validate({ body: heartbeatSchema }),
    studyMaterials.recordHeartbeat,
  );
  router.post('/:bookSlug/modules/:moduleSlug/complete', studyMaterials.markComplete);
  router.delete('/:bookSlug/modules/:moduleSlug/complete', studyMaterials.unmarkComplete);

  return router;
}
