import { forwardRef, useId } from 'react';

const controlClasses = (invalid) =>
  `block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 ${
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
  }`;

function Field({ id, label, hint, error, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="text-red-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// The error first, so it is read before the hint.
const describedBy = (id, error, hint) =>
  [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;

/** Labelled input wired for react-hook-form's `register()` and accessible error text. */
export const TextField = forwardRef(function TextField(
  { label, hint, error, required, id: idProp, ...props },
  ref,
) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        className={controlClasses(Boolean(error))}
        {...props}
      />
    </Field>
  );
});

export const TextAreaField = forwardRef(function TextAreaField(
  { label, hint, error, required, id: idProp, rows = 4, ...props },
  ref,
) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        className={controlClasses(Boolean(error))}
        {...props}
      />
    </Field>
  );
});

export const SelectField = forwardRef(function SelectField(
  { label, hint, error, required, id: idProp, children, ...props },
  ref,
) {
  const generated = useId();
  const id = idProp ?? generated;
  return (
    <Field id={id} label={label} hint={hint} error={error} required={required}>
      <select
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        aria-required={required || undefined}
        className={controlClasses(Boolean(error))}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
});
