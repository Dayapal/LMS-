import {
  CONTENT_STATUS,
  FILE_PURPOSES,
  FileAsset,
  Lesson,
  Material,
  MATERIAL_TYPES,
} from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { getLessonForViewer, visibleTo } from './access.service.js';
import { deleteFilesIfUnused } from './file.service.js';
import { applyOrder, nextOrder } from './ordering.js';
import { toMaterialDTO } from './serializers.js';

/** The payload fields each material type accepts besides `title` and `status`. */
const PAYLOAD_FIELDS = {
  [MATERIAL_TYPES.NOTE]: ['body'],
  [MATERIAL_TYPES.CODE]: ['language', 'source', 'caption'],
  [MATERIAL_TYPES.FILE]: ['fileId', 'downloadable'],
  [MATERIAL_TYPES.LINK]: ['url', 'description'],
};

const withFile = (query) => query.populate('file');

async function findLessonOr404(lessonId) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) throw ApiError.notFound('Lesson not found');
  return lesson;
}

async function findMaterialOr404(materialId) {
  const material = await Material.findById(materialId);
  if (!material) throw ApiError.notFound('Material not found');
  return material;
}

/** A material file uploaded for the same course, or a validation error on `fileId`. */
async function resolveFile(fileId, courseId) {
  const file = await FileAsset.findById(fileId);
  if (!file || file.purpose !== FILE_PURPOSES.MATERIAL || !file.course?.equals(courseId)) {
    throw ApiError.validation([
      { path: 'fileId', message: 'Upload the file for this course before attaching it' },
    ]);
  }
  return file;
}

/** The lesson's materials in order. Students see only published ones, and only in lessons they can open. */
export async function listMaterials(user, lessonId) {
  const { lesson } = await getLessonForViewer(user, lessonId);
  const materials = await withFile(
    Material.find({ lesson: lesson._id, ...visibleTo(user) }).sort({ order: 1 }),
  );
  return materials.map(toMaterialDTO);
}

export async function createMaterial(lessonId, { type, fileId, ...data }) {
  const lesson = await findLessonOr404(lessonId);
  const doc = {
    ...data,
    type,
    lesson: lesson._id,
    course: lesson.course,
    order: await nextOrder(Material, { lesson: lesson._id }),
  };
  if (type === MATERIAL_TYPES.FILE) doc.file = (await resolveFile(fileId, lesson.course))._id;
  const material = await Material.create(doc);
  await material.populate('file');
  return toMaterialDTO(material);
}

/**
 * Updates title, status and the payload of the material's own type. The type
 * itself can't change. Replacing a file deletes the old one if nothing else uses it.
 */
export async function updateMaterial(materialId, data) {
  const material = await findMaterialOr404(materialId);
  const allowed = new Set(['title', 'status', ...PAYLOAD_FIELDS[material.type]]);
  const foreign = Object.keys(data).filter((key) => !allowed.has(key));
  if (foreign.length > 0) {
    throw ApiError.validation(
      foreign.map((path) => ({ path, message: `Not used by ${material.type} materials` })),
    );
  }

  const { fileId, ...changes } = data;
  let replacedFile = null;
  if (fileId) {
    const file = await resolveFile(fileId, material.course);
    if (!file._id.equals(material.file)) {
      replacedFile = material.file;
      material.file = file._id;
    }
  }
  material.set(changes);
  await material.save();
  if (replacedFile) await deleteFilesIfUnused([replacedFile]);
  await material.populate('file');
  return toMaterialDTO(material);
}

export async function reorderMaterials(lessonId, ids) {
  const lesson = await findLessonOr404(lessonId);
  await applyOrder(Material, { lesson: lesson._id }, ids, 'material of this lesson');
  const materials = await withFile(Material.find({ lesson: lesson._id }).sort({ order: 1 }));
  return materials.map(toMaterialDTO);
}

export async function deleteMaterial(materialId) {
  const material = await findMaterialOr404(materialId);
  if (material.status === CONTENT_STATUS.PUBLISHED) {
    throw ApiError.conflict(
      'Published materials cannot be deleted. Move it back to draft or archive it first.',
    );
  }
  await material.deleteOne();
  if (material.file) await deleteFilesIfUnused([material.file]);
}

/** Removes the materials matching `filter`, and their files once nothing uses them. */
export async function deleteMaterialsWhere(filter) {
  const materials = await Material.find(filter).select('file').lean();
  if (materials.length === 0) return;
  await Material.deleteMany(filter);
  await deleteFilesIfUnused(materials.map((m) => m.file));
}
