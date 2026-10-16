import { useDeferredValue, useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router';
import { assignmentsApi, useAssignment, useAssignmentMutation } from '../api.js';
import { assignmentFormSchema, ATTACHMENT_RULES, checkAttachmentFile } from '../schemas.js';
import { fromLocalInput, localTimeZone, SUBMISSION_TYPES, toLocalInput } from '../format.js';
import { useRoadmap } from '../../courses/api.js';
import { listToLines } from '../../courses/format.js';
import { formatBytes } from '../../lessons/format.js';
import { MarkdownView } from '../../../components/content/MarkdownView.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../../../components/ui/Card.jsx';
import { ErrorState, PageHeader, Skeleton } from '../../../components/ui/Feedback.jsx';
import { SelectField, TextAreaField, TextField } from '../../../components/ui/FormField.jsx';
import { StatusSelect } from '../../../components/ui/FormParts.jsx';
import { useToast } from '../../../hooks/useToast.js';
import { getErrorMessage, getFieldErrors } from '../../../utils/apiErrors.js';

// Form fields that server validation errors can land on.
const FIELDS = new Set([
  'title',
  'status',
  'placement',
  'dueAt',
  'maxMarks',
  'maxAttempts',
  'allowedSubmissionTypes',
  'latePolicy.lateUntil',
  'latePolicy.penaltyPercent',
  'objectives',
  'instructions',
]);
const ALIASES = { moduleId: 'placement', lessonId: 'placement' };

/** A server field path as a form field name: `objectives.2` → `objectives`. */
const formField = (path) => {
  const name = path.replace(/\.\d+(\..*)?$/, '');
  return ALIASES[name] ?? name;
};

function defaultDueDate() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
}

const placementOf = (assignment) =>
  assignment?.lessonId
    ? `lesson:${assignment.lessonId}`
    : assignment?.moduleId
      ? `module:${assignment.moduleId}`
      : '';

function placementIds(placement) {
  const [kind, id] = placement.split(':');
  if (kind === 'lesson') return { moduleId: null, lessonId: id };
  if (kind === 'module') return { moduleId: id, lessonId: null };
  return { moduleId: null, lessonId: null };
}

const defaultsFor = (assignment) => ({
  title: assignment?.title ?? '',
  status: assignment?.status ?? 'draft',
  placement: placementOf(assignment),
  dueAt: toLocalInput(assignment?.dueAt ?? defaultDueDate()),
  maxMarks: String(assignment?.maxMarks ?? 100),
  maxAttempts: assignment ? String(assignment.maxAttempts ?? '') : '3',
  allowedSubmissionTypes: assignment?.allowedSubmissionTypes ?? ['github_url'],
  latePolicy: {
    allowLate: assignment?.latePolicy.allowLate ?? false,
    lateUntil: toLocalInput(assignment?.latePolicy.lateUntil),
    penaltyPercent: String(assignment?.latePolicy.penaltyPercent ?? 10),
  },
  objectives: listToLines(assignment?.objectives),
  instructions: assignment?.instructions ?? '',
});

/** New assignment (`/assignments/new`) or edit an existing one (`/assignments/:id/edit`). */
export function AssignmentEditorPage() {
  const { courseId, assignmentId } = useParams();
  const roadmap = useRoadmap(courseId);
  // Idle (never fetched) when creating.
  const existing = useAssignment(assignmentId);

  const loading = roadmap.isPending || (Boolean(assignmentId) && existing.isPending);
  const failed = roadmap.isError ? roadmap : existing.isError ? existing : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={assignmentId ? 'Edit assignment' : 'New assignment'}
        description={roadmap.data?.course.title}
      >
        <Link
          to={
            assignmentId
              ? `/admin/courses/${courseId}/assignments/${assignmentId}`
              : `/admin/courses/${courseId}`
          }
          state={assignmentId ? undefined : { tab: 'assignments' }}
          className="mb-2 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          ← {assignmentId ? 'Back to the assignment' : 'Back to the course'}
        </Link>
      </PageHeader>
      {loading ? (
        <div className="space-y-4" aria-label="Loading assignment">
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      ) : failed ? (
        <ErrorState
          message={
            failed.error.response?.status === 404
              ? 'This assignment or course does not exist.'
              : getErrorMessage(failed.error)
          }
          onRetry={failed.error.response?.status === 404 ? undefined : failed.refetch}
        />
      ) : (
        <AssignmentForm
          courseId={courseId}
          modules={roadmap.data.modules}
          assignment={existing.data}
        />
      )}
    </div>
  );
}

function AssignmentForm({ courseId, modules, assignment }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [formError, setFormError] = useState(null);
  const [kept, setKept] = useState(assignment?.attachments ?? []);
  const [pending, setPending] = useState([]); // files to upload on save
  const [fileError, setFileError] = useState(null);
  const [uploading, setUploading] = useState(null); // "Uploading 1 of 2…"
  const [pane, setPane] = useState('write');
  const fileInputId = useId();
  const typesId = useId();

  const save = useAssignmentMutation((body) =>
    assignment ? assignmentsApi.update(assignment.id, body) : assignmentsApi.create(body),
  );

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(assignmentFormSchema),
    defaultValues: defaultsFor(assignment),
  });
  const allowLate = watch('latePolicy.allowLate');
  const instructions = useDeferredValue(watch('instructions'));

  const onFilesChosen = (event) => {
    const chosen = [...(event.target.files ?? [])];
    event.target.value = '';
    const problems = chosen.map(checkAttachmentFile).filter(Boolean);
    setFileError(problems[0] ?? null);
    const valid = chosen.filter((file) => !checkAttachmentFile(file));
    setPending((current) => [...current, ...valid].slice(0, 10 - kept.length));
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      // Uploaded files join `kept`, so retrying after a failed save doesn't upload them twice.
      const attached = [...kept];
      try {
        for (const [index, file] of pending.entries()) {
          setUploading(`Uploading ${index + 1} of ${pending.length}: ${file.name}`);
          attached.push(await assignmentsApi.uploadAttachment(courseId, file));
        }
      } finally {
        setKept(attached);
        setPending((current) => current.slice(attached.length - kept.length));
        setUploading(null);
      }
      const { placement, latePolicy, ...rest } = values;
      const body = {
        ...rest,
        ...placementIds(placement),
        dueAt: fromLocalInput(values.dueAt),
        latePolicy: latePolicy.allowLate
          ? {
              allowLate: true,
              lateUntil: fromLocalInput(latePolicy.lateUntil),
              penaltyPercent: latePolicy.penaltyPercent,
            }
          : { allowLate: false, lateUntil: null, penaltyPercent: 0 },
        attachmentIds: attached.map((file) => file.id),
        ...(!assignment && { courseId }),
      };
      const saved = await save.mutateAsync(body);
      toast.success(assignment ? 'Assignment saved.' : 'Assignment created.');
      navigate(`/admin/courses/${courseId}/assignments/${saved.id}`);
    } catch (error) {
      const unplaced = [];
      for (const [path, message] of Object.entries(getFieldErrors(error))) {
        const name = formField(path);
        if (FIELDS.has(name)) setError(name, { type: 'server', message });
        else unplaced.push(message);
      }
      if (unplaced.length > 0 || Object.keys(getFieldErrors(error)).length === 0) {
        setFormError(unplaced[0] ?? getErrorMessage(error));
      }
    }
  });

  const tab = (id, label) => (
    <button
      type="button"
      aria-pressed={pane === id}
      onClick={() => setPane(id)}
      className={`rounded-md px-3 py-1 text-sm font-medium ${
        pane === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {formError && <Alert tone="error">{formError}</Alert>}

      <Card>
        <CardHeader title="Basics" />
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
            <TextField
              label="Title"
              required
              error={errors.title?.message}
              {...register('title')}
            />
            <StatusSelect
              register={register}
              error={errors.status?.message}
              hint="Enrolled students see published assignments."
            />
          </div>
          <SelectField
            label="Belongs to"
            hint="Assignments in a module or lesson are hidden while that module or lesson is unpublished."
            error={errors.placement?.message}
            {...register('placement')}
          >
            <option value="">The whole course</option>
            {modules.map((module) => (
              <optgroup key={module.id} label={module.title}>
                <option value={`module:${module.id}`}>Module: {module.title}</option>
                {module.lessons.map((lesson) => (
                  <option key={lesson.id} value={`lesson:${lesson.id}`}>
                    Lesson: {lesson.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Deadline and marks"
          description={`Times are in your time zone (${localTimeZone()}). Students see them in theirs.`}
        />
        <CardBody className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField
              label="Due"
              type="datetime-local"
              required
              error={errors.dueAt?.message}
              {...register('dueAt')}
            />
            <TextField
              label="Maximum marks"
              type="number"
              min={1}
              max={1000}
              required
              error={errors.maxMarks?.message}
              {...register('maxMarks')}
            />
            <TextField
              label="Attempts allowed"
              type="number"
              min={1}
              max={20}
              hint="Leave empty for unlimited."
              error={errors.maxAttempts?.message}
              {...register('maxAttempts')}
            />
          </div>
          <label className="flex items-start gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5 size-4 rounded border-slate-300 text-brand-600"
              {...register('latePolicy.allowLate')}
            />
            <span>
              <span className="font-medium">Accept late work</span>
              <span className="block text-slate-500">
                Work handed in after the due date is marked late and loses the penalty below.
              </span>
            </span>
          </label>
          {allowLate && (
            <div className="grid gap-5 sm:grid-cols-3">
              <TextField
                label="Accept late work until"
                type="datetime-local"
                required
                error={errors.latePolicy?.lateUntil?.message}
                {...register('latePolicy.lateUntil')}
              />
              <TextField
                label="Late penalty (%)"
                type="number"
                min={0}
                max={100}
                error={errors.latePolicy?.penaltyPercent?.message}
                {...register('latePolicy.penaltyPercent')}
              />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="How students submit" />
        <CardBody>
          <fieldset aria-describedby={errors.allowedSubmissionTypes ? typesId : undefined}>
            <legend className="mb-3 text-sm font-medium text-slate-700">
              Accepted submission types
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {SUBMISSION_TYPES.map((type) => (
                <label key={type.value} className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    value={type.value}
                    className="size-4 rounded border-slate-300 text-brand-600"
                    {...register('allowedSubmissionTypes')}
                  />
                  {type.label}
                </label>
              ))}
            </div>
            {errors.allowedSubmissionTypes && (
              <p id={typesId} className="mt-2 text-sm text-red-600">
                {errors.allowedSubmissionTypes.message}
              </p>
            )}
          </fieldset>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Instructions"
          description="Markdown, shown to students as formatted text."
        />
        <CardBody className="space-y-5">
          <TextAreaField
            label="Objectives"
            rows={3}
            hint="One per line."
            error={errors.objectives?.message}
            {...register('objectives')}
          />
          <div
            className="flex gap-1 rounded-lg bg-slate-100 p-1 lg:hidden"
            role="group"
            aria-label="Editor view"
          >
            {tab('write', 'Write')}
            {tab('preview', 'Preview')}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className={`[&_textarea]:font-mono ${pane === 'write' ? '' : 'max-lg:hidden'}`}>
              <TextAreaField
                label="Instructions (Markdown)"
                rows={14}
                error={errors.instructions?.message}
                {...register('instructions')}
              />
            </div>
            <section
              aria-label="Live preview"
              className={`min-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 lg:max-h-[24rem] ${
                pane === 'preview' ? '' : 'max-lg:hidden'
              }`}
            >
              <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Preview
              </p>
              {instructions.trim() ? (
                <MarkdownView>{instructions}</MarkdownView>
              ) : (
                <p className="text-sm text-slate-500">The formatted instructions appear here.</p>
              )}
            </section>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Handouts"
          description="Optional files for students: PDF, DOCX or PPTX, up to 20 MB each."
        />
        <CardBody className="space-y-4">
          {kept.length + pending.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {kept.map((file) => (
                <li key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">
                    {file.originalName}{' '}
                    <span className="text-slate-500">({formatBytes(file.size)})</span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${file.originalName}`}
                    onClick={() => setKept((current) => current.filter((f) => f.id !== file.id))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
              {pending.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {file.name}{' '}
                    <span className="text-slate-500">
                      ({formatBytes(file.size)}, uploaded when you save)
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setPending((current) => current.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div>
            <label
              htmlFor={fileInputId}
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Add files
            </label>
            <input
              id={fileInputId}
              type="file"
              multiple
              accept={ATTACHMENT_RULES.accept}
              onChange={onFilesChosen}
              aria-invalid={fileError ? true : undefined}
              className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            {fileError && <p className="mt-1.5 text-sm text-red-600">{fileError}</p>}
          </div>
        </CardBody>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {uploading && (
          <p role="status" className="text-sm text-slate-600 sm:mr-auto">
            {uploading}
          </p>
        )}
        <Link
          to={
            assignment
              ? `/admin/courses/${courseId}/assignments/${assignment.id}`
              : `/admin/courses/${courseId}`
          }
          state={assignment ? undefined : { tab: 'assignments' }}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-300 ring-inset hover:bg-slate-50"
        >
          Cancel
        </Link>
        <Button type="submit" loading={isSubmitting}>
          {assignment ? 'Save changes' : 'Create assignment'}
        </Button>
      </div>
    </form>
  );
}
