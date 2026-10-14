import * as courses from '../services/course.service.js';
import * as roadmap from '../services/roadmap.service.js';
import { requestEnrollment } from '../services/enrollment.service.js';
import { created, noContent, ok } from '../utils/respond.js';

export async function list(req, res) {
  const { items, meta } = await courses.listCourses(req.user, req.valid.query);
  ok(res, items, { meta });
}

export async function create(req, res) {
  created(res, await courses.createCourse(req.user, req.body));
}

export async function get(req, res) {
  ok(res, await courses.getCourse(req.user, req.valid.params.id));
}

export async function update(req, res) {
  ok(res, await courses.updateCourse(req.user, req.valid.params.id, req.body));
}

export async function setStatus(req, res) {
  ok(res, await courses.setCourseStatus(req.user, req.valid.params.id, req.body.status));
}

export async function remove(req, res) {
  await courses.deleteCourse(req.valid.params.id);
  noContent(res);
}

export async function getRoadmap(req, res) {
  ok(res, await courses.getRoadmap(req.user, req.valid.params.id));
}

export async function listModules(req, res) {
  ok(res, await roadmap.listModules(req.user, req.valid.params.id));
}

export async function createModule(req, res) {
  created(res, await roadmap.createModule(req.valid.params.id, req.body));
}

export async function reorderModules(req, res) {
  ok(res, await roadmap.reorderModules(req.valid.params.id, req.body.ids));
}

export async function enroll(req, res) {
  ok(res, await requestEnrollment(req.user, req.valid.params.id));
}
