import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../services/http.js';

const data = (res) => res.data.data;
const page = (res) => ({ items: res.data.data, meta: res.data.meta });

export const courseKeys = {
  all: ['courses'],
  list: (params) => ['courses', 'list', params],
  detail: (id) => ['courses', 'detail', id],
  roadmap: (id) => ['courses', 'roadmap', id],
  enrollments: (params) => ['enrollments', params],
};

export const coursesApi = {
  list: (params) => http.get('/courses', { params }).then(page),
  get: (id) => http.get(`/courses/${id}`).then(data),
  roadmap: (id) => http.get(`/courses/${id}/roadmap`).then(data),
  create: (body) => http.post('/courses', body).then(data),
  update: (id, body) => http.patch(`/courses/${id}`, body).then(data),
  setStatus: (id, status) => http.patch(`/courses/${id}/status`, { status }).then(data),
  remove: (id) => http.delete(`/courses/${id}`),
  createModule: (courseId, body) => http.post(`/courses/${courseId}/modules`, body).then(data),
  updateModule: (id, body) => http.patch(`/modules/${id}`, body).then(data),
  removeModule: (id) => http.delete(`/modules/${id}`),
  reorderModules: (courseId, ids) =>
    http.patch(`/courses/${courseId}/modules/reorder`, { ids }).then(data),
  createLesson: (moduleId, body) => http.post(`/modules/${moduleId}/lessons`, body).then(data),
  updateLesson: (id, body) => http.patch(`/lessons/${id}`, body).then(data),
  removeLesson: (id) => http.delete(`/lessons/${id}`),
  reorderLessons: (moduleId, ids) =>
    http.patch(`/modules/${moduleId}/lessons/reorder`, { ids }).then(data),
  requestEnrollment: (courseId) => http.post(`/courses/${courseId}/enroll`).then(data),
  listEnrollments: (params) => http.get('/admin/enrollments', { params }).then(page),
  enrollStudent: (body) => http.post('/admin/enrollments', body).then(data),
  updateEnrollment: (id, status) => http.patch(`/admin/enrollments/${id}`, { status }).then(data),
};

export const useCourses = (params) =>
  useQuery({
    queryKey: courseKeys.list(params),
    queryFn: () => coursesApi.list(params),
    placeholderData: keepPreviousData,
  });

export const useCourse = (id) =>
  useQuery({ queryKey: courseKeys.detail(id), queryFn: () => coursesApi.get(id) });

export const useRoadmap = (id) =>
  useQuery({ queryKey: courseKeys.roadmap(id), queryFn: () => coursesApi.roadmap(id) });

export const useEnrollments = (params) =>
  useQuery({
    queryKey: courseKeys.enrollments(params),
    queryFn: () => coursesApi.listEnrollments(params),
    placeholderData: keepPreviousData,
  });

/**
 * Mutation that refreshes every course query afterwards (lists, details,
 * roadmaps, enrollment lists and the student's own courses all depend on the same content).
 */
export function useCourseMutation(mutationFn, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    ...options,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]),
  });
}
