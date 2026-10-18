import { forwardRef, useId } from 'react';

const controlClasses = (invalid) =>
  `block w-full rounded-xl border px-3.5 py-2.5 text-sm backdrop-blur-md transition-all duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${
    invalid
      ? 'border-rose-400 bg-white/80 text-slate-900 focus:border-rose-500 focus:ring-rose-500/25 dark:border-rose-500/60 dark:bg-white/[0.07] dark:text-white'
      : 'border-slate-300/80 bg-white/80 text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-brand-500/20 dark:border-white/15 dark:bg-white/[0.07] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-400 dark:focus:ring-cyan-400/25'
  } disabled:bg-slate-100/60 disabled:text-slate-400 dark:disabled:bg-white/5 dark:disabled:text-slate-500`;

function Field({ id, label, hint, error, required, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
        {label}
        {required && (
          <span className="text-[#D12052] dark:text-rose-400" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-[#D12052] dark:text-rose-400">
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
        className={`${controlClasses(Boolean(error))} [&>option]:bg-white [&>option]:text-slate-900 dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100`}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
});
