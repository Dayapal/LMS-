import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { http } from '../../services/http.js';

const data = (res) => res.data.data;
const page = (res) => ({ items: res.data.data, meta: res.data.meta });

/**
 * The trainer's cross-course views. Everything lives under `['trainer']`, which
 * the course, enrollment and assignment mutations refresh, so the queue, the
 * dashboard and the reports update after a review or an enrollment decision.
 */
export const trainerKeys = {
  all: ['trainer'],
  queue: (params) => ['trainer', 'queue', params],
  students: (params) => ['trainer', 'students', params],
  student: (id) => ['trainer', 'student', id],
  studentReport: (id) => ['trainer', 'student', id, 'report'],
  dashboard: ['trainer', 'dashboard'],
  courseReports: (params) => ['trainer', 'reports', params],
  courseReport: (id, params) => ['trainer', 'reports', id, params],
};

export const trainerApi = {
  queue: (params) => http.get('/admin/submissions', { params }).then(page),
  students: (params) => http.get('/admin/students', { params }).then(page),
  student: (id) => http.get(`/admin/students/${id}`).then(data),
  studentReport: (id) => http.get(`/reports/students/${id}`).then(data),
  dashboard: () => http.get('/dashboard/admin').then(data),
  courseReports: (params) => http.get('/reports/courses', { params }).then(page),
  courseReport: (id, params) =>
    http.get(`/reports/courses/${id}`, { params }).then((res) => ({
      ...res.data.data,
      meta: res.data.meta,
    })),
};

export const useReviewQueue = (params) =>
  useQuery({
    queryKey: trainerKeys.queue(params),
    queryFn: () => trainerApi.queue(params),
    placeholderData: keepPreviousData,
  });

export const useStudents = (params) =>
  useQuery({
    queryKey: trainerKeys.students(params),
    queryFn: () => trainerApi.students(params),
    placeholderData: keepPreviousData,
  });

export const useStudentDetail = (id) =>
  useQuery({ queryKey: trainerKeys.student(id), queryFn: () => trainerApi.student(id) });

export const useStudentReport = (id) =>
  useQuery({
    queryKey: trainerKeys.studentReport(id),
    queryFn: () => trainerApi.studentReport(id),
  });

export const useTrainerDashboard = () =>
  useQuery({ queryKey: trainerKeys.dashboard, queryFn: trainerApi.dashboard });

export const useCourseReports = (params) =>
  useQuery({
    queryKey: trainerKeys.courseReports(params),
    queryFn: () => trainerApi.courseReports(params),
    placeholderData: keepPreviousData,
  });

export const useCourseReport = (id, params) =>
  useQuery({
    queryKey: trainerKeys.courseReport(id, params),
    queryFn: () => trainerApi.courseReport(id, params),
    placeholderData: keepPreviousData,
  });
