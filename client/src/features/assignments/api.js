import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../services/http.js';

const data = (res) => res.data.data;
const page = (res) => ({ items: res.data.data, meta: res.data.meta });

export const assignmentKeys = {
  all: ['assignments'],
  list: (params) => ['assignments', 'list', params],
  detail: (id) => ['assignments', 'detail', id],
  mine: (id) => ['assignments', 'detail', id, 'mine'],
  submissions: (id, params) => ['assignments', 'detail', id, 'submissions', params],
  submission: (id) => ['assignments', 'submission', id],
};

const withProgress = (onProgress) => ({
  onUploadProgress: (event) =>
    event.total && onProgress?.(Math.round((event.loaded / event.total) * 100)),
});

export const assignmentsApi = {
  list: (params) => http.get('/assignments', { params }).then(page),
  get: (id) => http.get(`/assignments/${id}`).then(data),
  create: (body) => http.post('/assignments', body).then(data),
  update: (id, body) => http.patch(`/assignments/${id}`, body).then(data),
  remove: (id) => http.delete(`/assignments/${id}`),
  /** Uploads a trainer handout for a course. `onProgress` receives 0–100. */
  uploadAttachment: (courseId, file, { onProgress } = {}) => {
    const form = new FormData();
    form.append('purpose', 'assignment');
    form.append('courseId', courseId);
    form.append('file', file);
    return http.post('/files', form, withProgress(onProgress)).then(data);
  },

  // Students
  mySubmissions: (id) => http.get(`/assignments/${id}/submissions/me`).then(data),
  submit: (id, body) => http.post(`/assignments/${id}/submissions`, body).then(data),
  updateSubmission: (submissionId, body) =>
    http.patch(`/submissions/${submissionId}`, body).then(data),
  /** Uploads the student's own PDF for an assignment. */
  uploadSubmissionFile: (id, file, { onProgress } = {}) => {
    const form = new FormData();
    form.append('file', file);
    return http.post(`/assignments/${id}/files`, form, withProgress(onProgress)).then(data);
  },

  // Trainer review
  submissions: (id, params) => http.get(`/assignments/${id}/submissions`, { params }).then(page),
  submission: (submissionId) => http.get(`/submissions/${submissionId}`).then(data),
  review: (submissionId, body) => http.post(`/submissions/${submissionId}/review`, body).then(data),
  requestResubmission: (submissionId, body) =>
    http.post(`/submissions/${submissionId}/request-resubmission`, body).then(data),
};

export const useAssignments = (params, { enabled = true } = {}) =>
  useQuery({
    queryKey: assignmentKeys.list(params),
    queryFn: () => assignmentsApi.list(params),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useAssignment = (id, { enabled = true } = {}) =>
  useQuery({
    queryKey: assignmentKeys.detail(id),
    queryFn: () => assignmentsApi.get(id),
    enabled: enabled && Boolean(id),
  });

export const useMySubmissions = (id) =>
  useQuery({ queryKey: assignmentKeys.mine(id), queryFn: () => assignmentsApi.mySubmissions(id) });

export const useAssignmentSubmissions = (id, params) =>
  useQuery({
    queryKey: assignmentKeys.submissions(id, params),
    queryFn: () => assignmentsApi.submissions(id, params),
    placeholderData: keepPreviousData,
  });

export const useSubmission = (submissionId) =>
  useQuery({
    queryKey: assignmentKeys.submission(submissionId),
    queryFn: () => assignmentsApi.submission(submissionId),
  });

/** A mutation that refreshes every assignment query afterwards. */
export function useAssignmentMutation(mutationFn, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    ...options,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: assignmentKeys.all }),
        // The student's dashboard and assignment list show the same states.
        queryClient.invalidateQueries({ queryKey: ['me'] }),
        // The review queue, trainer dashboard and reports count them too (Phase 6).
        queryClient.invalidateQueries({ queryKey: ['trainer'] }),
      ]),
  });
}
