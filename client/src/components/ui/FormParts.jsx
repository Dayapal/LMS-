import { Button } from './Button.jsx';
import { SelectField } from './FormField.jsx';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

/** Cancel + submit row at the bottom of a modal form. */
export function FormActions({ onCancel, submitting, label }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 pt-5 dark:border-white/10 sm:flex-row sm:justify-end">
      <Button variant="secondary" onClick={onCancel} disabled={submitting}>
        Cancel
      </Button>
      <Button type="submit" loading={submitting}>
        {label}
      </Button>
    </div>
  );
}

/** Draft / published / archived select wired to react-hook-form's `register`. */
export function StatusSelect({ register, error, hint }) {
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
