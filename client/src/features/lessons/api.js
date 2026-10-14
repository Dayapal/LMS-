import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../services/http.js';
import { courseKeys } from '../courses/api.js';

const data = (res) => res.data.data;

export const lessonKeys = {
  all: (lessonId) => ['lessons', lessonId],
  detail: (lessonId) => ['lessons', lessonId, 'detail'],
  materials: (lessonId) => ['lessons', lessonId, 'materials'],
  navigation: (lessonId) => ['lessons', lessonId, 'navigation'],
};

// FileReader also works where Blob#text() is missing (older engines, jsdom).
const readBlobText = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

/**
 * Blob requests return error bodies as Blobs too; turn them back into the
 * usual `{ success, error }` JSON so getErrorMessage() works.
 */
async function withJsonError(promise) {
  try {
    return await promise;
  } catch (error) {
    const body = error.response?.data;
    if (body instanceof Blob) {
      try {
        error.response.data = JSON.parse(await readBlobText(body));
      } catch {
        error.response.data = null;
      }
    }
    throw error;
  }
}

export const lessonsApi = {
  get: (lessonId) => http.get(`/lessons/${lessonId}`).then(data),
  materials: (lessonId) => http.get(`/lessons/${lessonId}/materials`).then(data),
  navigation: (lessonId) => http.get(`/lessons/${lessonId}/navigation`).then(data),
  createMaterial: (lessonId, body) => http.post(`/lessons/${lessonId}/materials`, body).then(data),
  updateMaterial: (materialId, body) => http.patch(`/materials/${materialId}`, body).then(data),
  removeMaterial: (materialId) => http.delete(`/materials/${materialId}`),
  reorderMaterials: (lessonId, ids) =>
    http.patch(`/lessons/${lessonId}/materials/reorder`, { ids }).then(data),
};

export const filesApi = {
  /** Uploads a study material file for a course. `onProgress` receives 0–100. */
  upload: (courseId, file, { onProgress } = {}) => {
    const form = new FormData();
    form.append('purpose', 'material');
    form.append('courseId', courseId);
    form.append('file', file);
    return http
      .post('/files', form, {
        onUploadProgress: (event) =>
          event.total && onProgress?.(Math.round((event.loaded / event.total) * 100)),
      })
      .then(data);
  },
  /**
   * Fetches a file with the signed-in user's token. Files are never public
   * URLs, so the browser gets them as Blobs.
   */
  fetch: (fileId, { download = false } = {}) =>
    withJsonError(
      http.get(`/files/${fileId}`, {
        responseType: 'blob',
        params: download ? { download: 1 } : undefined,
      }),
    ).then((res) => res.data),
};

export const useLesson = (lessonId) =>
  useQuery({ queryKey: lessonKeys.detail(lessonId), queryFn: () => lessonsApi.get(lessonId) });

export const useMaterials = (lessonId) =>
  useQuery({
    queryKey: lessonKeys.materials(lessonId),
    queryFn: () => lessonsApi.materials(lessonId),
  });

export const useLessonNavigation = (lessonId) =>
  useQuery({
    queryKey: lessonKeys.navigation(lessonId),
    queryFn: () => lessonsApi.navigation(lessonId),
  });

/** A mutation that refreshes the lesson's queries (and course stats) afterwards. */
export function useMaterialMutation(lessonId, mutationFn) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: lessonKeys.all(lessonId) }),
        queryClient.invalidateQueries({ queryKey: courseKeys.all }),
      ]),
  });
}
