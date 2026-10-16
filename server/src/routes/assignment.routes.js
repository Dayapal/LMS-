import { Router } from 'express';
import * as assignments from '../controllers/assignment.controller.js';
import * as submissions from '../controllers/submission.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { parseSubmissionUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../models/index.js';
import {
  createAssignmentSchema,
  createSubmissionSchema,
  listAssignmentsQuery,
  listSubmissionsQuery,
  resubmissionSchema,
  reviewSchema,
  updateAssignmentSchema,
  updateSubmissionSchema,
} from '../validators/assignment.validators.js';
import { idParams } from '../validators/content.validators.js';

const admin = requireRole(ROLES.ADMIN);
const student = requireRole(ROLES.STUDENT);
const byId = validate({ params: idParams });

export function assignmentRoutes(limiters) {
  const router = Router();
  router.use(authenticate);

  router.get('/', validate({ query: listAssignmentsQuery }), assignments.list);
  router.post('/', admin, validate({ body: createAssignmentSchema }), assignments.create);
  router.get('/:id', byId, assignments.get);
  router.patch(
    '/:id',
    admin,
    validate({ params: idParams, body: updateAssignmentSchema }),
    assignments.update,
  );
  router.delete('/:id', admin, byId, assignments.remove);

  router.get(
    '/:id/submissions',
    admin,
    validate({ params: idParams, query: listSubmissionsQuery }),
    assignments.listSubmissions,
  );
  router.get('/:id/submissions/me', student, byId, assignments.mySubmissions);
  router.post(
    '/:id/submissions',
    student,
    validate({ params: idParams, body: createSubmissionSchema }),
    assignments.submit,
  );
  // Role, rate limit and the right to submit are checked before the body is read.
  router.post(
    '/:id/files',
    student,
    limiters.uploads,
    byId,
    assignments.checkUpload,
    parseSubmissionUpload,
    assignments.uploadFile,
  );
  return router;
}

export function submissionRoutes() {
  const router = Router();
  router.use(authenticate);

  router.get('/:id', byId, submissions.get);
  router.patch(
    '/:id',
    student,
    validate({ params: idParams, body: updateSubmissionSchema }),
    submissions.update,
  );
  router.post(
    '/:id/review',
    admin,
    validate({ params: idParams, body: reviewSchema }),
    submissions.review,
  );
  router.post(
    '/:id/request-resubmission',
    admin,
    validate({ params: idParams, body: resubmissionSchema }),
    submissions.requestResubmission,
  );
  return router;
}
