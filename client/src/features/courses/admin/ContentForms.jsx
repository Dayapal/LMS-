import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { SelectField, TextAreaField, TextField } from '../../../components/ui/FormField.jsx';
import { applyFieldErrors, getErrorMessage } from '../../../utils/apiErrors.js';
import { lessonFormSchema, moduleFormSchema } from '../schemas.js';
import { listToLines, STATUS_OPTIONS } from '../format.js';

function useServerAwareForm(schema, defaultValues, onSubmit) {
  const [formError, setFormError] = useState(null);
  const form = useForm({ resolver: zodResolver(schema), defaultValues });
  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      if (!applyFieldErrors(error, form.setError)) setFormError(getErrorMessage(error));
    }
  });
  return { ...form, submit, formError };
}

function FormActions({ onCancel, submitting, label }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel} disabled={submitting}>
        Cancel
      </Button>
      <Button type="submit" loading={submitting}>
        {label}
      </Button>
    </div>
  );
}

function StatusSelect({ register, error, hint }) {
  return (
    <SelectField label="Status" hint={hint} error={error} {...register('status')}>
      {STATUS_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </SelectField>
  );
}

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
