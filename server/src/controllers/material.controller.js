import * as materials from '../services/material.service.js';
import { getLessonNavigation } from '../services/roadmap.service.js';
import { created, noContent, ok } from '../utils/respond.js';

export async function list(req, res) {
  ok(res, await materials.listMaterials(req.user, req.valid.params.id));
}

export async function create(req, res) {
  created(res, await materials.createMaterial(req.valid.params.id, req.body));
}

export async function reorder(req, res) {
  ok(res, await materials.reorderMaterials(req.valid.params.id, req.body.ids));
}

export async function update(req, res) {
  ok(res, await materials.updateMaterial(req.valid.params.id, req.body));
}

export async function remove(req, res) {
  await materials.deleteMaterial(req.valid.params.id);
  noContent(res);
}

export async function navigation(req, res) {
  ok(res, await getLessonNavigation(req.user, req.valid.params.id));
}
