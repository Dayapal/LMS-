import * as enrollments from '../services/enrollment.service.js';
import { created, ok } from '../utils/respond.js';

export async function list(req, res) {
  const { items, meta } = await enrollments.listEnrollments(req.valid.query);
  ok(res, items, { meta });
}

export async function create(req, res) {
  created(res, await enrollments.enrollStudent(req.user, req.body));
}

export async function update(req, res) {
  ok(res, await enrollments.updateEnrollmentStatus(req.user, req.valid.params.id, req.body.status));
}
