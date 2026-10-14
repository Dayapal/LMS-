const FALLBACK = 'Something went wrong. Please try again.';

/** A human-readable message for any error thrown by the API clients. */
export function getErrorMessage(error, fallback = FALLBACK) {
  if (!error?.response) {
    return error?.request ? 'Cannot reach the server. Check your connection.' : fallback;
  }
  return error.response.data?.error?.message ?? fallback;
}

/** Field-level validation details from a VALIDATION_ERROR response, as { path: message }. */
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.filter((d) => d.path).map((d) => [d.path, d.message]));
}

/**
 * Copies server field errors onto a react-hook-form instance.
 * Returns true when at least one field error was applied.
 */
export function applyFieldErrors(error, setError) {
  const fields = getFieldErrors(error);
  for (const [name, message] of Object.entries(fields)) {
    setError(name, { type: 'server', message });
  }
  return Object.keys(fields).length > 0;
}
