import { useContext } from 'react';
import { ToastContext } from '../context/toastContextObject.js';

const noop = { success: () => {}, error: () => {} };

/** Toast notifications; a no-op outside <ToastProvider> (e.g. in isolated tests). */
export function useToast() {
  return useContext(ToastContext) ?? noop;
}
