import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '../../services/http.js';

const data = (res) => res.data.data;

export const studyKeys = {
  all: ['study-materials'],
  adminCatalogue: ['study-materials', 'admin', 'catalogue'],
  adminPreview: (id) => ['study-materials', 'admin', 'preview', id],
  adminAccessOverview: ['study-materials', 'admin', 'access'],
  adminAccessDetail: (id) => ['study-materials', 'admin', 'access', id],
  studentBooks: ['study-materials', 'student', 'books'],
  studentSummary: ['study-materials', 'student', 'summary'],
  studentBookDetail: (slug) => ['study-materials', 'student', 'book', slug],
  studentModuleContent: (bookSlug, moduleSlug) => [
    'study-materials',
    'student',
    'content',
    bookSlug,
    moduleSlug,
  ],
};

export const studyMaterialsApi = {
  // Admin endpoints
  getAdminCatalogue: () => http.get('/study-materials/admin/catalogue').then(data),
  updateModule: (id, body) =>
    http.patch(`/study-materials/admin/modules/${id}`, body).then(data),
  updateBook: (id, body) =>
    http.patch(`/study-materials/admin/books/${id}`, body).then(data),
  getAdminPreview: (id) =>
    http.get(`/study-materials/admin/modules/${id}/preview`).then(data),
  getStudentsAccess: () => http.get('/study-materials/admin/access').then(data),
  getStudentAccessDetail: (id) =>
    http.get(`/study-materials/admin/access/${id}`).then(data),
  updateStudentAccess: (id, body) =>
    http.put(`/study-materials/admin/access/${id}`, body).then(data),
  bulkUpdateStudentAccess: (body) =>
    http.post('/study-materials/admin/access/bulk', body).then(data),

  // Student endpoints
  getStudentBooks: () => http.get('/study-materials').then(data),
  getStudentStudySummary: () => http.get('/study-materials/summary').then(data),
  getStudentBookDetail: (bookSlug) =>
    http.get(`/study-materials/${bookSlug}`).then(data),
  getStudentModuleContent: (bookSlug, moduleSlug) =>
    http.get(`/study-materials/${bookSlug}/modules/${moduleSlug}/content`).then(data),
  sendHeartbeat: ({ bookSlug, moduleSlug, activeSeconds, scrollPosition }) =>
    http
      .post(`/study-materials/${bookSlug}/modules/${moduleSlug}/heartbeat`, {
        activeSeconds,
        scrollPosition,
      })
      .then(data),
  markModuleComplete: ({ bookSlug, moduleSlug }) =>
    http.post(`/study-materials/${bookSlug}/modules/${moduleSlug}/complete`).then(data),
  unmarkModuleComplete: ({ bookSlug, moduleSlug }) =>
    http.delete(`/study-materials/${bookSlug}/modules/${moduleSlug}/complete`).then(data),
};

// React Query Hooks

export const useAdminStudyCatalogue = () =>
  useQuery({
    queryKey: studyKeys.adminCatalogue,
    queryFn: studyMaterialsApi.getAdminCatalogue,
  });

export const useUpdateStudyModule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => studyMaterialsApi.updateModule(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studyKeys.adminCatalogue });
    },
  });
};

export const useUpdateStudyBook = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => studyMaterialsApi.updateBook(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studyKeys.adminCatalogue });
    },
  });
};

export const useAdminStudyPreview = (moduleId) =>
  useQuery({
    queryKey: studyKeys.adminPreview(moduleId),
    queryFn: () => studyMaterialsApi.getAdminPreview(moduleId),
    enabled: Boolean(moduleId),
  });

export const useAdminStudentsAccess = () =>
  useQuery({
    queryKey: studyKeys.adminAccessOverview,
    queryFn: studyMaterialsApi.getStudentsAccess,
  });

export const useAdminStudentAccessDetail = (studentId) =>
  useQuery({
    queryKey: studyKeys.adminAccessDetail(studentId),
    queryFn: () => studyMaterialsApi.getStudentAccessDetail(studentId),
    enabled: Boolean(studentId),
  });

export const useUpdateStudentAccess = (studentId) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => studyMaterialsApi.updateStudentAccess(studentId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studyKeys.adminAccessOverview });
      queryClient.invalidateQueries({ queryKey: studyKeys.adminAccessDetail(studentId) });
    },
  });
};

export const useBulkUpdateStudentAccess = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => studyMaterialsApi.bulkUpdateStudentAccess(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studyKeys.adminAccessOverview });
    },
  });
};

export const useStudentStudyBooks = () =>
  useQuery({
    queryKey: studyKeys.studentBooks,
    queryFn: studyMaterialsApi.getStudentBooks,
  });

export const useStudentStudySummary = () =>
  useQuery({
    queryKey: studyKeys.studentSummary,
    queryFn: studyMaterialsApi.getStudentStudySummary,
  });

export const useStudentStudyBookDetail = (bookSlug) =>
  useQuery({
    queryKey: studyKeys.studentBookDetail(bookSlug),
    queryFn: () => studyMaterialsApi.getStudentBookDetail(bookSlug),
    enabled: Boolean(bookSlug),
  });

export const useStudentStudyModuleContent = (bookSlug, moduleSlug) =>
  useQuery({
    queryKey: studyKeys.studentModuleContent(bookSlug, moduleSlug),
    queryFn: () => studyMaterialsApi.getStudentModuleContent(bookSlug, moduleSlug),
    enabled: Boolean(bookSlug) && Boolean(moduleSlug),
  });

export const useToggleModuleCompletion = (bookSlug, moduleSlug) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ isCompleted }) =>
      isCompleted
        ? studyMaterialsApi.markModuleComplete({ bookSlug, moduleSlug })
        : studyMaterialsApi.unmarkModuleComplete({ bookSlug, moduleSlug }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studyKeys.studentBooks });
      queryClient.invalidateQueries({ queryKey: studyKeys.studentSummary });
      queryClient.invalidateQueries({ queryKey: studyKeys.studentBookDetail(bookSlug) });
      queryClient.invalidateQueries({ queryKey: studyKeys.studentModuleContent(bookSlug, moduleSlug) });
    },
  });
};

