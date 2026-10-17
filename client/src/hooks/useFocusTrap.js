import { useEffect, useRef } from 'react';

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside `ref` while `active` (a modal dialog or the
 * navigation drawer):
 * - on activation, focuses the `[autofocus]` element, else the first
 *   focusable one inside `initialFocusRef` (or the container), else the container;
 * - Tab and Shift+Tab wrap around; Escape calls `onEscape`;
 * - on deactivation, focus returns to the element that had it before, unless
 *   something else already took it (for example the page after a navigation).
 */
export function useFocusTrap(ref, active, { onEscape, initialFocusRef } = {}) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const container = ref.current;
    const opener = document.activeElement;
    const scope = initialFocusRef?.current ?? container;
    const first = container?.querySelector('[autofocus]') ?? scope?.querySelector(FOCUSABLE);
    (first ?? container)?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !container) return;
      const items = [...container.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const [firstItem, lastItem] = [items[0], items.at(-1)];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const current = document.activeElement;
      const focusLost = !current || current === document.body || container?.contains(current);
      if (focusLost && opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [active, ref, initialFocusRef]);
}
