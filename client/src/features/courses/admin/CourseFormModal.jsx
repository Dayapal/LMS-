import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { SelectField, TextAreaField, TextField } from '../../../components/ui/FormField.jsx';
import { applyFieldErrors, getErrorMessage } from '../../../utils/apiErrors.js';
import { courseFormSchema } from '../schemas.js';
import { LEVEL_LABEL } from '../format.js';

const toFormValues = (course) => ({
  title: course?.title ?? '',
  summary: course?.summary ?? '',
  description: course?.description ?? '',
  thumbnailUrl: course?.thumbnailUrl ?? '',
  level: course?.level ?? 'beginner',
  estimatedHours: course?.estimatedHours ?? 0,
  tags: course?.tags?.join(', ') ?? '',
});

/** Create (no `course`) or edit course details. `onSubmit` receives API-ready values. */
export function CourseFormModal({ open, course, onClose, onSubmit }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={course ? 'Edit course details' : 'New course'}
      description={course ? undefined : 'New courses start as drafts that students cannot see.'}
    >
      {/* Remount the form for each open so it starts from the current values. */}
      {open && <CourseForm course={course} onCancel={onClose} onSubmit={onSubmit} />}
    </Modal>
  );
}

function CourseForm({ course, onCancel, onSubmit }) {
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(courseFormSchema), defaultValues: toFormValues(course) });

  const submit = async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
    } catch (error) {
      if (!applyFieldErrors(error, setError)) setFormError(getErrorMessage(error));
    }
  };

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TextField label="Title" required error={errors.title?.message} {...register('title')} />
      <TextAreaField
        label="Summary"
        rows={2}
        hint="One or two sentences shown on course cards."
        error={errors.summary?.message}
        {...register('summary')}
      />
      <TextAreaField
        label="Description"
        rows={6}
        hint="Shown on the course page. Separate paragraphs with a blank line."
        error={errors.description?.message}
        {...register('description')}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField label="Level" error={errors.level?.message} {...register('level')}>
          {Object.entries(LEVEL_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Estimated hours"
          type="number"
          min="0"
          inputMode="numeric"
          error={errors.estimatedHours?.message}
          {...register('estimatedHours')}
        />
      </div>
      <TextField
        label="Tags"
        hint="Comma-separated, e.g. react, node"
        error={errors.tags?.message}
        {...register('tags')}
      />
      <TextField
        label="Thumbnail URL"
        type="url"
        placeholder="https://"
        hint="Optional. Leave empty to use a generated cover."
        error={errors.thumbnailUrl?.message}
        {...register('thumbnailUrl')}
      />
      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {course ? 'Save changes' : 'Create course'}
        </Button>
      </div>
    </form>
  );
}
