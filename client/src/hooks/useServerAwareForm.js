import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { applyFieldErrors, getErrorMessage } from '../utils/apiErrors.js';

/**
 * react-hook-form with a zod schema, where server validation errors land on
 * their fields and any other failure becomes `formError`.
 */
export function useServerAwareForm(schema, defaultValues, onSubmit) {
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
  return { ...form, submit, formError, setFormError };
}
