import { Modal } from '../../../components/ui/Modal.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { SelectField, TextAreaField, TextField } from '../../../components/ui/FormField.jsx';
import { FormActions, StatusSelect } from '../../../components/ui/FormParts.jsx';
import { useServerAwareForm } from '../../../hooks/useServerAwareForm.js';
import { lessonFormSchema, moduleFormSchema } from '../schemas.js';
import { listToLines } from '../format.js';

export function ModuleFormModal({ open, module, onClose, onSubmit }) {
  return (
    <Modal open={open} onClose={onClose} title={module ? 'Edit module' : 'Add module'}>
      {open && <ModuleForm module={module} onCancel={onClose} onSubmit={onSubmit} />}
    </Modal>
  );
}

function ModuleForm({ module, onCancel, onSubmit }) {
  const {
    register,
    submit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerAwareForm(
    moduleFormSchema,
    {
      title: module?.title ?? '',
      description: module?.description ?? '',
      status: module?.status ?? 'draft',
    },
    onSubmit,
  );
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField label="Title" required error={errors.title?.message} {...register('title')} />
      <TextAreaField
        label="Description"
        rows={3}
        error={errors.description?.message}
        {...register('description')}
      />
      <StatusSelect
        register={register}
        error={errors.status?.message}
        hint="Students only see published modules of published courses."
      />
      <FormActions
        onCancel={onCancel}
        submitting={isSubmitting}
        label={module ? 'Save module' : 'Add module'}
      />
    </form>
  );
}

/**
 * Create a lesson in `moduleId`, or edit `lesson` (including moving it to
 * another module of the course).
 */
export function LessonFormModal({ open, lesson, moduleId, modules, onClose, onSubmit }) {
  return (
    <Modal open={open} onClose={onClose} size="lg" title={lesson ? 'Edit lesson' : 'Add lesson'}>
      {open && (
        <LessonForm
          lesson={lesson}
          moduleId={moduleId}
          modules={modules}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      )}
    </Modal>
  );
}

function LessonForm({ lesson, moduleId, modules, onCancel, onSubmit }) {
  const {
    register,
    submit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerAwareForm(
    lessonFormSchema,
    {
      title: lesson?.title ?? '',
      summary: lesson?.summary ?? '',
      objectives: listToLines(lesson?.objectives),
      prerequisites: listToLines(lesson?.prerequisites),
      estimatedMinutes: lesson?.estimatedMinutes ?? 30,
      status: lesson?.status ?? 'draft',
      moduleId: lesson?.moduleId ?? moduleId,
    },
    onSubmit,
  );
  const listError = (field) => errors[field]?.message ?? errors[field]?.[0]?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField label="Title" required error={errors.title?.message} {...register('title')} />
      <TextAreaField
        label="Summary"
        rows={2}
        hint="A short description shown on the roadmap."
        error={errors.summary?.message}
        {...register('summary')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextAreaField
          label="Learning objectives"
          rows={4}
          hint="One per line."
          error={listError('objectives')}
          {...register('objectives')}
        />
        <TextAreaField
          label="Prerequisites"
          rows={4}
          hint="One per line. Optional."
          error={listError('prerequisites')}
          {...register('prerequisites')}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          label="Estimated minutes"
          type="number"
          min="0"
          inputMode="numeric"
          error={errors.estimatedMinutes?.message}
          {...register('estimatedMinutes')}
        />
        <StatusSelect register={register} error={errors.status?.message} />
        <SelectField label="Module" error={errors.moduleId?.message} {...register('moduleId')}>
          {modules.map((m, index) => (
            <option key={m.id} value={m.id}>
              {index + 1}. {m.title}
            </option>
          ))}
        </SelectField>
      </div>
      <FormActions
        onCancel={onCancel}
        submitting={isSubmitting}
        label={lesson ? 'Save lesson' : 'Add lesson'}
      />
    </form>
  );
}
