import { useState } from 'react';
import { Link } from 'react-router';
import { coursesApi, useCourseMutation } from '../api.js';
import { formatMinutes, moveId, plural } from '../format.js';
import { LessonFormModal, ModuleFormModal } from './ContentForms.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { StatusBadge } from '../../../components/ui/Badge.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { EmptyState } from '../../../components/ui/Feedback.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';

function IconButton({ label, onClick, disabled, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}

const Arrow = ({ up }) => (
  <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
    <path d={up ? 'M10 5l5 6H5l5-6Z' : 'M10 15l-5-6h10l-5 6Z'} />
  </svg>
);

const nextPublishState = (status) => (status === 'published' ? 'draft' : 'published');

export function RoadmapEditor({ courseId, modules }) {
  const toast = useToast();
  const [moduleForm, setModuleForm] = useState(null); // { module? }
  const [lessonForm, setLessonForm] = useState(null); // { lesson?, moduleId }
  const [confirm, setConfirm] = useState(null); // { title, message, action }

  const run = useCourseMutation((fn) => fn());
  const busy = run.isPending;

  const perform = async (fn, successMessage) => {
    try {
      await run.mutateAsync(fn);
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(getErrorMessage(error));
      return false;
    }
  };

  const moduleIds = modules.map((m) => m.id);

  const saveModule = async (values) => {
    const editing = moduleForm.module;
    await run.mutateAsync(() =>
      editing
        ? coursesApi.updateModule(editing.id, values)
        : coursesApi.createModule(courseId, values),
    );
    toast.success(editing ? 'Module saved.' : 'Module added.');
    setModuleForm(null);
  };

  const saveLesson = async ({ moduleId, ...values }) => {
    const editing = lessonForm.lesson;
    await run.mutateAsync(() =>
      editing
        ? coursesApi.updateLesson(editing.id, { ...values, moduleId })
        : coursesApi.createLesson(moduleId, values),
    );
    toast.success(editing ? 'Lesson saved.' : 'Lesson added.');
    setLessonForm(null);
  };

  const askDelete = (kind, item) =>
    setConfirm({
      title: `Delete ${kind}?`,
      message:
        kind === 'module'
          ? `“${item.title}” and all of its lessons will be permanently deleted. Published content must be unpublished or archived first.`
          : `“${item.title}” will be permanently deleted. Published lessons must be unpublished or archived first.`,
      action: () =>
        kind === 'module' ? coursesApi.removeModule(item.id) : coursesApi.removeLesson(item.id),
      success: `${kind === 'module' ? 'Module' : 'Lesson'} deleted.`,
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {plural(modules.length, 'module')} ·{' '}
          {plural(
            modules.reduce((sum, m) => sum + m.lessons.length, 0),
            'lesson',
          )}
        </p>
        <Button size="sm" onClick={() => setModuleForm({})}>
          Add module
        </Button>
      </div>

      {modules.length === 0 ? (
        <EmptyState
          title="No modules yet"
          action={<Button onClick={() => setModuleForm({})}>Add the first module</Button>}
        >
          Modules group lessons into the steps of the roadmap.
        </EmptyState>
      ) : (
        <ol className="space-y-4">
          {modules.map((module, moduleIndex) => {
            const lessonIds = module.lessons.map((l) => l.id);
            return (
              <li
                key={module.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
              >
                <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                    {moduleIndex + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{module.title}</h3>
                      <StatusBadge status={module.status} />
                    </div>
                    {module.description && (
                      <p className="mt-0.5 text-sm text-slate-500">{module.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton
                      label={`Move module ${module.title} up`}
                      disabled={busy || moduleIndex === 0}
                      onClick={() =>
                        perform(() =>
                          coursesApi.reorderModules(courseId, moveId(moduleIds, moduleIndex, -1)),
                        )
                      }
                    >
                      <Arrow up />
                    </IconButton>
                    <IconButton
                      label={`Move module ${module.title} down`}
                      disabled={busy || moduleIndex === modules.length - 1}
                      onClick={() =>
                        perform(() =>
                          coursesApi.reorderModules(courseId, moveId(moduleIds, moduleIndex, 1)),
                        )
                      }
                    >
                      <Arrow />
                    </IconButton>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`${module.status === 'published' ? 'Unpublish' : 'Publish'} module ${module.title}`}
                      onClick={() =>
                        perform(
                          () =>
                            coursesApi.updateModule(module.id, {
                              status: nextPublishState(module.status),
                            }),
                          module.status === 'published'
                            ? 'Module unpublished.'
                            : 'Module published.',
                        )
                      }
                    >
                      {module.status === 'published' ? 'Unpublish' : 'Publish'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Edit module ${module.title}`}
                      onClick={() => setModuleForm({ module })}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete module ${module.title}`}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => askDelete('module', module)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {module.lessons.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-slate-500">No lessons in this module yet.</p>
                ) : (
                  <ol className="divide-y divide-slate-100">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <li
                        key={lesson.id}
                        className="flex flex-wrap items-center gap-3 px-4 py-2.5 sm:flex-nowrap"
                      >
                        <span className="w-10 shrink-0 text-xs font-medium text-slate-500">
                          {moduleIndex + 1}.{lessonIndex + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {lesson.title}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatMinutes(lesson.estimatedMinutes)} ·{' '}
                            {plural(lesson.objectives.length, 'objective')}
                          </p>
                        </div>
                        <StatusBadge status={lesson.status} />
                        <div className="flex items-center gap-1">
                          <IconButton
                            label={`Move lesson ${lesson.title} up`}
                            disabled={busy || lessonIndex === 0}
                            onClick={() =>
                              perform(() =>
                                coursesApi.reorderLessons(
                                  module.id,
                                  moveId(lessonIds, lessonIndex, -1),
                                ),
                              )
                            }
                          >
                            <Arrow up />
                          </IconButton>
                          <IconButton
                            label={`Move lesson ${lesson.title} down`}
                            disabled={busy || lessonIndex === module.lessons.length - 1}
                            onClick={() =>
                              perform(() =>
                                coursesApi.reorderLessons(
                                  module.id,
                                  moveId(lessonIds, lessonIndex, 1),
                                ),
                              )
                            }
                          >
                            <Arrow />
                          </IconButton>
                          <Link
                            to={`/admin/courses/${courseId}/lessons/${lesson.id}`}
                            aria-label={`Materials for lesson ${lesson.title}`}
                            className="inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium text-brand-700 hover:bg-brand-50"
                          >
                            Materials
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Edit lesson ${lesson.title}`}
                            onClick={() => setLessonForm({ lesson, moduleId: module.id })}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete lesson ${lesson.title}`}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => askDelete('lesson', lesson)}
                          >
                            Delete
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="border-t border-slate-100 px-4 py-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Add lesson to ${module.title}`}
                    onClick={() => setLessonForm({ moduleId: module.id })}
                  >
                    + Add lesson
                  </Button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ModuleFormModal
        open={Boolean(moduleForm)}
        module={moduleForm?.module}
        onClose={() => setModuleForm(null)}
        onSubmit={saveModule}
      />
      <LessonFormModal
        open={Boolean(lessonForm)}
        lesson={lessonForm?.lesson}
        moduleId={lessonForm?.moduleId}
        modules={modules}
        onClose={() => setLessonForm(null)}
        onSubmit={saveLesson}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Delete"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await perform(confirm.action, confirm.success);
          setConfirm(null);
        }}
      />
    </div>
  );
}
