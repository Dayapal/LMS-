import { getTrainerDashboard } from '../services/dashboard.service.js';
import { getCourseReport, listCourseReports } from '../services/report.service.js';
import { listReviewQueue } from '../services/review.service.js';
import { getStudentDetail, getStudentReport, listStudents } from '../services/student.service.js';
import { ok } from '../utils/respond.js';

export async function reviewQueue(req, res) {
  const { items, meta } = await listReviewQueue(req.valid.query);
  ok(res, items, { meta });
}

export async function students(req, res) {
  const { items, meta } = await listStudents(req.valid.query);
  ok(res, items, { meta });
}

export async function student(req, res) {
  ok(res, await getStudentDetail(req.valid.params.id));
}

export async function dashboard(_req, res) {
  ok(res, await getTrainerDashboard());
}

export async function courseReports(req, res) {
  const { items, meta } = await listCourseReports(req.valid.query);
  ok(res, items, { meta });
}

export async function courseReport(req, res) {
  const { data, meta } = await getCourseReport(req.valid.params.id, req.valid.query);
  ok(res, data, { meta });
}

export async function studentReport(req, res) {
  ok(res, await getStudentReport(req.valid.params.id));
}
