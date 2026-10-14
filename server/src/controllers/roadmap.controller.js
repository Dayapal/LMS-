import * as roadmap from '../services/roadmap.service.js';
import { created, noContent, ok } from '../utils/respond.js';

export async function updateModule(req, res) {
  ok(res, await roadmap.updateModule(req.valid.params.id, req.body));
}

export async function deleteModule(req, res) {
  await roadmap.deleteModule(req.valid.params.id);
  noContent(res);
}

export async function listLessons(req, res) {
  ok(res, await roadmap.listLessons(req.user, req.valid.params.id));
}

export async function createLesson(req, res) {
  created(res, await roadmap.createLesson(req.valid.params.id, req.body));
}

export async function reorderLessons(req, res) {
  ok(res, await roadmap.reorderLessons(req.valid.params.id, req.body.ids));
}

export async function getLesson(req, res) {
  ok(res, await roadmap.getLesson(req.user, req.valid.params.id));
}

export async function updateLesson(req, res) {
  ok(res, await roadmap.updateLesson(req.valid.params.id, req.body));
}

export async function deleteLesson(req, res) {
  await roadmap.deleteLesson(req.valid.params.id);
  noContent(res);
}
