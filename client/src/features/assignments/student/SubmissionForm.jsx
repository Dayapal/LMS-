import { useId, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { assignmentsApi } from '../api.js';
import { checkSubmissionPdf, codeSizeProblem, linkProblem, noteSchema } from '../schemas.js';
import { submissionTypeLabel } from '../format.js';
import { formatBytes } from '../../lessons/format.js';
import { LazyCodeEditor } from '../../../components/content/LazyCodeEditor.jsx';
import { CODE_LANGUAGES } from '../../../components/content/languages.js';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { SelectField, TextAreaField, TextField } from '../../../components/ui/FormField.jsx';
import { getErrorMessage, getFieldErrors } from '../../../utils/apiErrors.js';

const LINK_TYPES = ['github_url', 'project_url', 'drive_url'];

const LINK_HINT = {
  github_url: 'https://github.com/<you>/<repository>',
  project_url: 'The public https:// address of your deployed app',
  drive_url: 'A Google Drive or Google Docs link. Make sure your trainer can open it.',
};

const defaultsFrom = (submission) => {
  const items = submission?.items ?? [];
  const link = (type) => items.find((item) => item.type === type)?.url ?? '';
  const code = items.find((item) => item.type === 'code')?.code;
  return {
    links: Object.fromEntries(LINK_TYPES.map((type) => [type, link(type)])),
    code: { language: code?.language ?? 'javascript', source: code?.source ?? '' },
    note: submission?.note ?? '',
  };
};

/**
 * Hand in work for an assignment: one field per accepted type, of which at
 * least one must be filled in. A new PDF is uploaded when the form is sent.
 * With `submission`, edits that attempt instead of creating a new one.
 */
export function SubmissionForm({ assignment, submission, onDone, onCancel }) {
  const allowed = assignment.allowedSubmissionTypes;
  const existingPdf = submission?.items.find((item) => item.type === 'pdf')?.file ?? null;
  const [keptPdf, setKeptPdf] = useState(existingPdf);
  const [pdf, setPdf] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [formError, setFormError] = useState(null);
  const pdfInputId = useId();
  const pdfHintId = useId();
  const codeLabelId = useId();
  const codeErrorId = useId();

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: defaultsFrom(submission) });
  const language = watch('code.language');

  const onPdfChange = (event) => {
    const chosen = event.target.files?.[0] ?? null;
    setFormError(null);
    setPdf(null);
    if (!chosen) return setPdfError(null);
    const problem = checkSubmissionPdf(chosen);
    setPdfError(problem);
    if (!problem) setPdf(chosen);
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    // Items in a fixed order, remembering which form field each one came from.
    const items = [];
    const fieldOf = [];
    let invalid = false;
    for (const type of LINK_TYPES.filter((t) => allowed.includes(t))) {
      const url = values.links[type].trim();
      if (!url) continue;
      const problem = linkProblem(type, url);
      if (problem) {
        setError(`links.${type}`, { type: 'validate', message: problem });
        invalid = true;
      }
      items.push({ type, url });
      fieldOf.push({ url: `links.${type}` });
    }
    if (allowed.includes('code') && values.code.source.trim()) {
      const problem = codeSizeProblem(values.code.source);
      if (problem) {
        setError('code.source', { type: 'validate', message: problem });
        invalid = true;
      }
      items.push({ type: 'code', code: values.code });
      fieldOf.push({ 'code.source': 'code.source', 'code.language': 'code.language' });
    }
    const note = noteSchema.safeParse(values.note);
    if (!note.success) {
      setError('note', { type: 'validate', message: note.error.issues[0].message });
      invalid = true;
    }
    if (pdfError) invalid = true;
    const hasPdf = allowed.includes('pdf') && (pdf || keptPdf);
    if (!invalid && items.length === 0 && !hasPdf) {
      setFormError('Add at least one link, file or code snippet before submitting.');
      return;
    }
    if (invalid) return;

    try {
      if (allowed.includes('pdf')) {
        let fileId = keptPdf?.id;
        if (pdf) {
          setProgress(0);
          try {
            const uploaded = await assignmentsApi.uploadSubmissionFile(assignment.id, pdf, {
              onProgress: setProgress,
            });
            fileId = uploaded.id;
            setKeptPdf(uploaded);
            setPdf(null);
          } finally {
            setProgress(null);
          }
        }
        if (fileId) {
          items.push({ type: 'pdf', fileId });
          fieldOf.push({ fileId: 'pdf' });
        }
      }
      const body = { items, note: note.data };
      const saved = submission
        ? await assignmentsApi.updateSubmission(submission.id, body)
        : await assignmentsApi.submit(assignment.id, body);
      await onDone(saved);
    } catch (error) {
      // Map `items.2.url` and similar back onto the field that produced the item.
      const unplaced = [];
      for (const [path, message] of Object.entries(getFieldErrors(error))) {
        const match = path.match(/^items\.(\d+)\.(.+)$/);
        const field = match
          ? fieldOf[Number(match[1])]?.[match[2]]
          : path === 'note'
            ? 'note'
            : null;
        if (field === 'pdf') setPdfError(message);
        else if (field) setError(field, { type: 'server', message });
        else unplaced.push(message);
      }
      if (unplaced.length > 0 || Object.keys(getFieldErrors(error)).length === 0) {
        setFormError(unplaced[0] ?? getErrorMessage(error));
      }
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && <Alert tone="error">{formError}</Alert>}
      <p className="text-sm text-slate-600">Fill in at least one of the fields below.</p>

      {LINK_TYPES.filter((type) => allowed.includes(type)).map((type) => (
        <TextField
          key={type}
          label={submissionTypeLabel(type)}
          type="url"
          inputMode="url"
          placeholder="https://"
          hint={LINK_HINT[type]}
          error={errors.links?.[type]?.message}
          {...register(`links.${type}`)}
        />
      ))}

      {allowed.includes('pdf') && (
        <div>
          <label htmlFor={pdfInputId} className="mb-1.5 block text-sm font-medium text-slate-700">
            {keptPdf ? 'Replace the PDF' : 'PDF file'}
          </label>
          {keptPdf && (
            <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>
                Current file: <span className="font-medium">{keptPdf.originalName}</span> (
                {formatBytes(keptPdf.size)})
              </span>
              <Button size="sm" variant="ghost" onClick={() => setKeptPdf(null)}>
                Remove
              </Button>
            </p>
          )}
          <input
            id={pdfInputId}
            type="file"
            accept=".pdf,application/pdf"
            onChange={onPdfChange}
            aria-invalid={pdfError ? true : undefined}
            aria-describedby={pdfHintId}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
          <p
            id={pdfHintId}
            className={`mt-1.5 text-sm ${pdfError ? 'text-red-600' : 'text-slate-500'}`}
          >
            {pdfError ??
              (pdf
                ? `${pdf.name} (${formatBytes(pdf.size)}) will be uploaded when you submit.`
                : 'PDF only, up to 10 MB. Only you and your trainer can open it.')}
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
      )}

      {allowed.includes('code') && (
        <div className="space-y-3">
          <SelectField
            label="Code language"
            error={errors.code?.language?.message}
            {...register('code.language')}
          >
            {CODE_LANGUAGES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectField>
          <div>
            <p id={codeLabelId} className="mb-1.5 block text-sm font-medium text-slate-700">
              Code snippet
            </p>
            <Controller
              name="code.source"
              control={control}
              render={({ field }) => (
                <LazyCodeEditor
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  language={language}
                  labelledBy={codeLabelId}
                  describedBy={errors.code?.source ? codeErrorId : undefined}
                />
              )}
            />
            {errors.code?.source ? (
              <p id={codeErrorId} className="mt-1.5 text-sm text-red-600">
                {errors.code.source.message}
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-slate-500">
                Up to 100 KB. Your code is stored as text and never run.
              </p>
            )}
          </div>
        </div>
      )}

      <TextAreaField
        label="Note for your trainer"
        rows={3}
        hint="Optional."
        error={errors.note?.message}
        {...register('note')}
      />

      <div className="flex flex-col-reverse gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={isSubmitting}>
          {submission ? 'Save changes' : 'Submit'}
        </Button>
      </div>
    </form>
  );
}
