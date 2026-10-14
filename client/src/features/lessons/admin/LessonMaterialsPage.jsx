import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { lessonsApi, useLesson, useMaterialMutation, useMaterials } from '../api.js';
import { MATERIAL_TYPE_LABEL, materialSummary } from '../format.js';
import { MaterialFormModal } from './MaterialForms.jsx';
import { moveId, plural } from '../../courses/format.js';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Badge, StatusBadge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog.jsx';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../../components/ui/Feedback.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage } from '../../../utils/apiErrors.js';

const ADD_BUTTONS = [
  { type: 'note', label: 'Add note' },
  { type: 'code', label: 'Add code' },
  { type: 'file', label: 'Add file' },
  { type: 'link', label: 'Add link' },
];

const TYPE_TONE = { note: 'info', code: 'neutral', file: 'warning', link: 'success' };

const Arrow = ({ up }) => (
  <svg viewBox="0 0 20 20" className="size-4" fill="currentColor" aria-hidden="true">
    <path d={up ? 'M10 5l5 6H5l5-6Z' : 'M10 15l-5-6h10l-5 6Z'} />
  </svg>
);

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

/** The trainer's editor for one lesson's study materials. */
export function LessonMaterialsPage() {
  const { courseId, lessonId } = useParams();
  const toast = useToast();
  const lesson = useLesson(lessonId);
  const materials = useMaterials(lessonId);
  const [form, setForm] = useState(null); // { type, material? }
  const [confirm, setConfirm] = useState(null); // material to delete

  const run = useMaterialMutation(lessonId, (fn) => fn());
  const busy = run.isPending;

  const perform = async (fn, successMessage) => {
    try {
      await run.mutateAsync(fn);
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const save = async (values) => {
    const editing = form.material;
    await run.mutateAsync(() =>
      editing
        ? lessonsApi.updateMaterial(editing.id, values)
        : lessonsApi.createMaterial(lessonId, { type: form.type, ...values }),
    );
    toast.success(editing ? 'Material saved.' : 'Material added.');
    setForm(null);
  };

  if (lesson.isPending) {
    return (
      <div className="space-y-6" aria-label="Loading lesson">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-32" />
      </div>
    );
  }
  if (lesson.isError) {
    const notFound = lesson.error.response?.status === 404;
    return (
      <div className="space-y-4">
        <ErrorState
          message={notFound ? 'This lesson does not exist.' : getErrorMessage(lesson.error)}
          onRetry={notFound ? undefined : lesson.refetch}
        />
        <Link
          to={`/admin/courses/${courseId}`}
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Back to the course
        </Link>
      </div>
    );
  }

  const data = lesson.data;
  const items = materials.data ?? [];
  const ids = items.map((m) => m.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        description={`${data.course.title} · ${data.module.title}`}
        actions={
          <Link
            to={`/admin/courses/${courseId}/lessons/${lessonId}/preview`}
            className="inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
          >
            Preview as student
          </Link>
        }
      >
        <Link
          to={`/admin/courses/${courseId}`}
          className="mb-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← Course builder
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span>Lesson status:</span>
        <StatusBadge status={data.status} />
      </div>
      {data.status !== 'published' && (
        <Alert tone="info">
          This lesson is not published, so students can&apos;t open it yet. Publish it from the
          course builder when its materials are ready.
        </Alert>
      )}

      <section aria-labelledby="materials-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="materials-heading" className="text-lg font-semibold text-slate-900">
              Study materials
            </h2>
            <p className="text-sm text-slate-500">
              {plural(items.length, 'material')}, shown to students in this order.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ADD_BUTTONS.map((button) => (
              <Button
                key={button.type}
                size="sm"
                variant={button.type === 'note' ? 'primary' : 'secondary'}
                onClick={() => setForm({ type: button.type })}
              >
                {button.label}
              </Button>
            ))}
          </div>
        </div>

        {materials.isPending ? (
          <Skeleton className="h-40" />
        ) : materials.isError ? (
          <ErrorState message={getErrorMessage(materials.error)} onRetry={materials.refetch} />
        ) : items.length === 0 ? (
          <EmptyState title="No materials yet">
            Add notes, code examples, PDF handouts and links. Students see them in order.
          </EmptyState>
        ) : (
          <ol className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            {items.map((material, index) => (
              <li
                key={material.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap"
              >
                <span className="w-6 shrink-0 text-xs font-medium text-slate-400">{index + 1}</span>
                <Badge tone={TYPE_TONE[material.type]} className="shrink-0">
                  {MATERIAL_TYPE_LABEL[material.type]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{material.title}</p>
                  <p className="truncate text-xs text-slate-500">{materialSummary(material)}</p>
                </div>
                <StatusBadge status={material.status} />
                <div className="flex items-center gap-1">
                  <IconButton
                    label={`Move ${material.title} up`}
                    disabled={busy || index === 0}
                    onClick={() =>
                      perform(() => lessonsApi.reorderMaterials(lessonId, moveId(ids, index, -1)))
                    }
                  >
                    <Arrow up />
                  </IconButton>
                  <IconButton
                    label={`Move ${material.title} down`}
                    disabled={busy || index === items.length - 1}
                    onClick={() =>
                      perform(() => lessonsApi.reorderMaterials(lessonId, moveId(ids, index, 1)))
                    }
                  >
                    <Arrow />
                  </IconButton>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`${material.status === 'published' ? 'Unpublish' : 'Publish'} ${material.title}`}
                    onClick={() =>
                      perform(
                        () =>
                          lessonsApi.updateMaterial(material.id, {
                            status: material.status === 'published' ? 'draft' : 'published',
                          }),
                        material.status === 'published'
                          ? 'Material unpublished.'
                          : 'Material published.',
                      )
                    }
                  >
                    {material.status === 'published' ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Edit ${material.title}`}
                    onClick={() => setForm({ type: material.type, material })}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${material.title}`}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setConfirm(material)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <MaterialFormModal
        open={Boolean(form)}
        type={form?.type}
        material={form?.material}
        courseId={data.course.id}
        onClose={() => setForm(null)}
        onSubmit={save}
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete material?"
        message={`“${confirm?.title}” will be permanently deleted${
          confirm?.type === 'file'
            ? ', and its file is removed unless another material uses it'
            : ''
        }. Published materials must be unpublished first.`}
        confirmLabel="Delete"
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          await perform(() => lessonsApi.removeMaterial(confirm.id), 'Material deleted.');
          setConfirm(null);
        }}
      />
    </div>
  );
}
