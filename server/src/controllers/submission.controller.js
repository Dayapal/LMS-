import * as submissions from '../services/submission.service.js';
import { ok } from '../utils/respond.js';

export async function get(req, res) {
  ok(res, await submissions.getSubmission(req.user, req.valid.params.id));
}

export async function update(req, res) {
  ok(res, await submissions.updateSubmission(req.user, req.valid.params.id, req.body));
}

export async function review(req, res) {
  ok(res, await submissions.reviewSubmission(req.user, req.valid.params.id, req.body));
}

export async function requestResubmission(req, res) {
  ok(res, await submissions.requestResubmission(req.user, req.valid.params.id, req.body));
}
