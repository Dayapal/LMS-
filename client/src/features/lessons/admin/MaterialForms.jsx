import { useDeferredValue, useId, useState } from 'react';
import { Controller } from 'react-hook-form';
import { Modal } from '../../../components/ui/Modal.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { SelectField, TextAreaField, TextField } from '../../../components/ui/FormField.jsx';
import { FormActions, StatusSelect } from '../../../components/ui/FormParts.jsx';
import { MarkdownView } from '../../../components/content/MarkdownView.jsx';
import { LazyCodeEditor } from '../../../components/content/LazyCodeEditor.jsx';
import { CODE_LANGUAGES } from '../../../components/content/languages.js';
import { useServerAwareForm } from '../../../hooks/useServerAwareForm.js';
import {
  checkMaterialFile,
  codeFormSchema,
  fileFormSchema,
  linkFormSchema,
  MATERIAL_FILE_RULES,
  noteFormSchema,
} from '../schemas.js';
import { filesApi } from '../api.js';
import { formatBytes } from '../format.js';

const STATUS_HINT = 'Students see published materials of published lessons.';

const TITLES = { note: 'note', code: 'code example', file: 'file', link: 'link' };

/**
 * Add or edit one material. `onSubmit(values)` saves it; for files the form
 * uploads the chosen file first and passes its `fileId`.
 */
export function MaterialFormModal({ open, type, material, courseId, onClose, onSubmit }) {
  const editing = Boolean(material);
  const title = `${editing ? 'Edit' : 'Add'} ${TITLES[type] ?? 'material'}`;
  const props = { material, onCancel: onClose, onSubmit, courseId };
  return (
    <Modal open={open} onClose={onClose} title={title} size={type === 'note' ? 'xl' : 'lg'}>
      {open && type === 'note' && <NoteForm {...props} />}
      {open && type === 'code' && <CodeForm {...props} />}
      {open && type === 'file' && <FileForm {...props} />}
      {open && type === 'link' && <LinkForm {...props} />}
    </Modal>
  );
}

const saveLabel = (material, noun) => (material ? 'Save changes' : `Add ${noun}`);

function TitleAndStatus({ register, errors }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <TextField label="Title" required error={errors.title?.message} {...register('title')} />
      <StatusSelect register={register} error={errors.status?.message} hint={STATUS_HINT} />
    </div>
  );
}

function NoteForm({ material, onCancel, onSubmit }) {
  const {
    register,
    submit,
    watch,
    formError,
    formState: { errors, isSubmitting },
  } = useServerAwareForm(
    noteFormSchema,
    {
      title: material?.title ?? 'Lesson notes',
      status: material?.status ?? 'draft',
      body: material?.body ?? '',
    },
    onSubmit,
  );
  const [pane, setPane] = useState('write'); // small screens show one pane at a time
  const body = useDeferredValue(watch('body'));

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
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TitleAndStatus register={register} errors={errors} />
      <div
        className="flex gap-1 rounded-lg bg-slate-100 p-1 lg:hidden"
        role="group"
        aria-label="Editor view"
      >
        {tab('write', 'Write')}
        {tab('preview', 'Preview')}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className={`[&_textarea]:font-mono ${pane === 'write' ? '' : 'max-lg:hidden'}`}>
          <TextAreaField
            label="Note (Markdown)"
            rows={18}
            required
            hint="Use ## headings, **bold**, lists, `code`, links and ``` fenced code blocks."
            error={errors.body?.message}
            {...register('body')}
          />
        </div>
        <section
          aria-label="Live preview"
          // Focusable so keyboard users can scroll a long preview (WCAG 2.1.1).
          tabIndex={0}
          className={`min-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 lg:max-h-[29rem] ${
            pane === 'preview' ? '' : 'max-lg:hidden'
          }`}
        >
          <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Preview
          </p>
          {body.trim() ? (
            <MarkdownView>{body}</MarkdownView>
          ) : (
            <p className="text-sm text-slate-500">The formatted note appears here as you type.</p>
          )}
        </section>
      </div>
      <FormActions
        onCancel={onCancel}
        submitting={isSubmitting}
        label={saveLabel(material, 'note')}
      />
    </form>
  );
}

function CodeForm({ material, onCancel, onSubmit }) {
  const {
    register,
    control,
    submit,
    watch,
    formError,
    formState: { errors, isSubmitting },
  } = useServerAwareForm(
    codeFormSchema,
    {
      title: material?.title ?? '',
      status: material?.status ?? 'draft',
      language: material?.language ?? 'javascript',
      source: material?.source ?? '',
      caption: material?.caption ?? '',
    },
    onSubmit,
  );
  const labelId = useId();
  const errorId = useId();
  const language = watch('language');

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TitleAndStatus register={register} errors={errors} />
      <SelectField label="Language" error={errors.language?.message} {...register('language')}>
        {CODE_LANGUAGES.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <div>
        <p id={labelId} className="mb-1.5 block text-sm font-medium text-slate-700">
          Code{' '}
          <span className="text-red-600" aria-hidden="true">
            *
          </span>
        </p>
        <Controller
          name="source"
          control={control}
          render={({ field }) => (
            <LazyCodeEditor
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              language={language}
              labelledBy={labelId}
              describedBy={errors.source ? errorId : undefined}
            />
          )}
        />
        {errors.source && (
          <p id={errorId} className="mt-1.5 text-sm text-red-600">
            {errors.source.message}
          </p>
        )}
      </div>
      <TextField
        label="Caption"
        hint="Optional. A short note shown under the code."
        error={errors.caption?.message}
        {...register('caption')}
      />
      <FormActions
        onCancel={onCancel}
        submitting={isSubmitting}
        label={saveLabel(material, 'code example')}
      />
    </form>
  );
}

function FileForm({ material, courseId, onCancel, onSubmit }) {
  const [file, setFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [progress, setProgress] = useState(null);
  // The upload of the chosen file, so retrying after a failed save doesn't store it twice.
  const [uploaded, setUploaded] = useState(null);
  const inputId = useId();
  const hintId = useId();

  const save = async (values) => {
    let fileId;
    if (file && uploaded?.file === file) {
      fileId = uploaded.id;
    } else if (file) {
      setProgress(0);
      try {
        fileId = (await filesApi.upload(courseId, file, { onProgress: setProgress })).id;
        setUploaded({ file, id: fileId });
      } finally {
        setProgress(null);
      }
    }
    await onSubmit({ ...values, ...(fileId && { fileId }) });
  };

  const {
    register,
    submit,
    formError,
    setFormError,
    formState: { errors, isSubmitting },
  } = useServerAwareForm(
    fileFormSchema,
    {
      title: material?.title ?? '',
      status: material?.status ?? 'draft',
      downloadable: material?.downloadable ?? true,
    },
    save,
  );

  const onFileChange = (event) => {
    const chosen = event.target.files?.[0] ?? null;
    setFormError(null);
    setFile(null);
    if (!chosen) return setFileError(null);
    const problem = checkMaterialFile(chosen);
    setFileError(problem);
    if (!problem) setFile(chosen);
  };

  const handleSubmit = (event) => {
    if (fileError || (!material && !file)) {
      event.preventDefault();
      setFileError(fileError ?? 'Choose a file to upload');
      return undefined;
    }
    return submit(event);
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TitleAndStatus register={register} errors={errors} />
      <div>
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">
          {material ? 'Replace the file' : 'File'}
          {!material && (
            <span className="text-red-600" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
        {material?.file && (
          <p className="mb-2 text-sm text-slate-600">
            Current file: <span className="font-medium">{material.file.originalName}</span> (
            {formatBytes(material.file.size)})
          </p>
        )}
        <input
          id={inputId}
          type="file"
          accept={MATERIAL_FILE_RULES.accept}
          onChange={onFileChange}
          aria-invalid={fileError ? true : undefined}
          aria-describedby={hintId}
          className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        <p
          id={hintId}
          className={`mt-1.5 text-sm ${fileError ? 'text-red-600' : 'text-slate-500'}`}
        >
          {fileError ??
            (file
              ? `${file.name} (${formatBytes(file.size)}) will be uploaded when you save.`
              : 'PDF, DOCX or PPTX, up to 20 MB. Files are private to enrolled students.')}
        </p>
        {progress !== null && (
          <div className="mt-2" role="status" aria-label={`Uploading: ${progress}%`}>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-slate-300 text-brand-600"
          {...register('downloadable')}
        />
        <span>
          <span className="font-medium">Allow students to download</span>
          <span className="block text-slate-500">
            When off, PDFs can only be viewed in the lesson. This hides the download button; it
            can&apos;t stop a determined student from saving what they can view.
          </span>
        </span>
      </label>
      <FormActions
        onCancel={onCancel}
        submitting={isSubmitting}
        label={saveLabel(material, 'file')}
      />
    </form>
  );
}

function LinkForm({ material, onCancel, onSubmit }) {
  const {
    register,
    submit,
    formError,
    formState: { errors, isSubmitting },
  } = useServerAwareForm(
    linkFormSchema,
    {
      title: material?.title ?? '',
      status: material?.status ?? 'draft',
      url: material?.url ?? '',
      description: material?.description ?? '',
    },
    onSubmit,
  );
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <TitleAndStatus register={register} errors={errors} />
      <TextField
        label="Address"
        type="url"
        required
        placeholder="https://"
        error={errors.url?.message}
        {...register('url')}
      />
      <TextAreaField
        label="Description"
        rows={3}
        hint="Optional. Why this link is worth reading."
        error={errors.description?.message}
        {...register('description')}
      />
      <FormActions
        onCancel={onCancel}
        submitting={isSubmitting}
        label={saveLabel(material, 'link')}
      />
    </form>
  );
}
