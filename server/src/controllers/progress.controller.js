import * as progress from '../services/progress.service.js';
import { listMyAssignments } from '../services/assignment.service.js';
import { getStudentDashboard } from '../services/dashboard.service.js';
import { ok } from '../utils/respond.js';

export async function complete(req, res) {
  ok(res, await progress.completeLesson(req.user, req.valid.params.id));
}

export async function uncomplete(req, res) {
  ok(res, await progress.uncompleteLesson(req.user, req.valid.params.id));
}

export async function myCourses(req, res) {
  ok(res, await progress.listMyCourses(req.user));
}

export async function myAssignments(req, res) {
  const { items, meta } = await listMyAssignments(req.user, req.valid.query);
  ok(res, items, { meta });
}

export async function studentDashboard(req, res) {
  ok(res, await getStudentDashboard(req.user));
}

export async function visit(req, res) {
  ok(res, await progress.visitLesson(req.user, req.valid.params.id));
}
