import * as studyMaterials from '../services/studyMaterials.service.js';
import { ok } from '../utils/respond.js';

export async function getAdminCatalogue(_req, res) {
  const data = await studyMaterials.getAdminBooksCatalogue();
  ok(res, data);
}

export async function updateModule(req, res) {
  const data = await studyMaterials.updateAdminStudyModule(req.params.id, req.body);
  ok(res, data);
}

export async function updateBook(req, res) {
  const data = await studyMaterials.updateAdminStudyBook(req.params.id, req.body);
  ok(res, data);
}

export async function getAdminPreview(req, res) {
  const data = await studyMaterials.getAdminModulePreview(req.params.id);
  ok(res, data);
}

export async function getStudentsAccessOverview(_req, res) {
  const data = await studyMaterials.getAdminStudentsAccessOverview();
  ok(res, data);
}

export async function getStudentAccessDetail(req, res) {
  const data = await studyMaterials.getAdminStudentAccessDetail(req.params.id);
  ok(res, data);
}

export async function updateStudentAccess(req, res) {
  const data = await studyMaterials.updateAdminStudentAccess(
    req.params.id,
    req.body,
    req.user,
  );
  ok(res, data);
}

export async function bulkUpdateStudentAccess(req, res) {
  const data = await studyMaterials.bulkUpdateAdminStudentAccess(req.body, req.user);
  ok(res, data);
}

export async function getStudentBooks(req, res) {
  const data = await studyMaterials.getStudentStudyBooks(req.user);
  ok(res, data);
}

export async function getStudentBookDetail(req, res) {
  const data = await studyMaterials.getStudentBookDetail(req.params.bookSlug, req.user);
  ok(res, data);
}

export async function getStudentModuleContent(req, res) {
  const data = await studyMaterials.getStudentModuleContent(
    req.params.bookSlug,
    req.params.moduleSlug,
    req.user,
  );
  ok(res, data);
}

export async function recordHeartbeat(req, res) {
  const data = await studyMaterials.recordReadingHeartbeat({
    user: req.user,
    bookSlug: req.params.bookSlug,
    moduleSlug: req.params.moduleSlug,
    activeSeconds: req.body.activeSeconds,
    scrollPosition: req.body.scrollPosition,
  });
  ok(res, data);
}

export async function markComplete(req, res) {
  const data = await studyMaterials.setModuleCompletion({
    user: req.user,
    bookSlug: req.params.bookSlug,
    moduleSlug: req.params.moduleSlug,
    isCompleted: true,
  });
  ok(res, data);
}

export async function unmarkComplete(req, res) {
  const data = await studyMaterials.setModuleCompletion({
    user: req.user,
    bookSlug: req.params.bookSlug,
    moduleSlug: req.params.moduleSlug,
    isCompleted: false,
  });
  ok(res, data);
}

export async function getStudentStudySummary(req, res) {
  const data = await studyMaterials.getStudentStudySummary(req.user);
  ok(res, data);
}

export async function getAdminReports(req, res) {
  const data = await studyMaterials.getAdminStudyReports({
    subject: req.query.subject,
    search: req.query.search,
  });
  ok(res, data);
}

export async function exportAdminReportsCsv(req, res) {
  const csv = await studyMaterials.exportAdminStudyReportsCsv({
    subject: req.query.subject,
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="study-materials-report.csv"');
  res.send(csv);
}

export async function getMyReport(req, res) {
  const data = await studyMaterials.getStudentProgressReport(req.user);
  ok(res, data);
}


