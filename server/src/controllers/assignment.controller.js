import * as assignments from '../services/assignment.service.js';
import * as submissions from '../services/submission.service.js';
import { uploadSubmissionFile } from '../services/file.service.js';
import { created, noContent, ok } from '../utils/respond.js';

export async function list(req, res) {
  const { items, meta } = await assignments.listAssignments(req.user, req.valid.query);
  ok(res, items, { meta });
}

export async function create(req, res) {
  created(res, await assignments.createAssignment(req.user, req.body));
}

export async function get(req, res) {
  ok(res, await assignments.getAssignment(req.user, req.valid.params.id));
}

export async function update(req, res) {
  ok(res, await assignments.updateAssignment(req.user, req.valid.params.id, req.body));
}

export async function remove(req, res) {
  await assignments.deleteAssignment(req.valid.params.id);
  noContent(res);
}

export async function listSubmissions(req, res) {
  const { items, meta } = await assignments.listAssignmentSubmissions(
    req.valid.params.id,
    req.valid.query,
  );
  ok(res, items, { meta });
}

export async function mySubmissions(req, res) {
  ok(res, await submissions.listMySubmissions(req.user, req.valid.params.id));
}

export async function submit(req, res) {
  created(res, await submissions.createSubmission(req.user, req.valid.params.id, req.body));
}

/** Runs before the multipart body is read, so refused uploads are never buffered. */
export async function checkUpload(req, _res, next) {
  req.assignment = await submissions.assignmentForUpload(req.user, req.valid.params.id);
  next();
}

export async function uploadFile(req, res) {
  created(res, await uploadSubmissionFile(req.user, req.assignment, req.file));
}
