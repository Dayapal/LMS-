import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../services/http.js';
import { courseKeys } from '../courses/api.js';
import { lessonKeys } from '../lessons/api.js';

const data = (res) => res.data.data;
const page = (res) => ({ items: res.data.data, meta: res.data.meta });

/** Everything about the signed-in student's own learning lives under `['me']`. */
export const progressKeys = {
  all: ['me'],
  courses: ['me', 'courses'],
  assignments: (params) => ['me', 'assignments', params],
  dashboard: ['me', 'dashboard'],
};

export const progressApi = {
  // No body: the server decides who, which course and when.
  visit: (lessonId) => http.post(`/lessons/${lessonId}/visit`).then(data),
  complete: (lessonId) => http.post(`/lessons/${lessonId}/complete`).then(data),
  uncomplete: (lessonId) => http.delete(`/lessons/${lessonId}/complete`).then(data),
  myCourses: () => http.get('/me/courses').then(data),
  myAssignments: (params) => http.get('/me/assignments', { params }).then(page),
  dashboard: () => http.get('/dashboard/student').then(data),
};

export const useStudentDashboard = () =>
  useQuery({ queryKey: progressKeys.dashboard, queryFn: progressApi.dashboard });

export const useMyCourses = () =>
  useQuery({ queryKey: progressKeys.courses, queryFn: progressApi.myCourses });

export const useMyAssignments = (params) =>
  useQuery({
    queryKey: progressKeys.assignments(params),
    queryFn: () => progressApi.myAssignments(params),
    placeholderData: keepPreviousData,
  });

/**
 * Marks a lesson complete (`true`) or incomplete (`false`). The lesson's own
 * query takes the server's answer at once; the roadmap and the student's
 * dashboard queries refresh afterwards.
 */
export function useLessonCompletion(lessonId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (completed) =>
      completed ? progressApi.complete(lessonId) : progressApi.uncomplete(lessonId),
    onSuccess: (result) =>
      queryClient.setQueryData(lessonKeys.detail(lessonId), (lesson) =>
        lesson
          ? {
              ...lesson,
              completion: { completed: result.completed, completedAt: result.completedAt },
            }
          : lesson,
      ),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKeys.all }),
        queryClient.invalidateQueries({ queryKey: progressKeys.all }),
      ]),
  });
}

/**
 * Records an opened lesson as the student's continue-learning point, once per
 * lesson after it has loaded. Reading a lesson never changes anything on the
 * server; this explicit request does. Failures are ignored: it's bookkeeping.
 */
export function useRecordLessonVisit(lessonId, enabled) {
  const queryClient = useQueryClient();
  const { mutate } = useMutation({
    mutationFn: (id) => progressApi.visit(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: courseKeys.all }),
        queryClient.invalidateQueries({ queryKey: progressKeys.all }),
      ]),
  });
  useEffect(() => {
    if (enabled && lessonId) mutate(lessonId);
  }, [enabled, lessonId, mutate]);
}
