import { useEffect, useRef } from 'react';

export const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Safari (macOS and iOS) doesn't focus a button when it is clicked or tapped,
// so `document.activeElement` is <body>, or whatever had focus before (such as
// <main> after a navigation), when a dialog opens. A control clicked just
// before the trap opens (seen in the capture phase, before its own handler
// opens the dialog) is therefore taken as the opener.
const CLICK_OPENS_WITHIN_MS = 1000;
let lastClick = { element: null, at: 0 };
if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (event) => {
      const element = event.target instanceof Element ? event.target.closest(FOCUSABLE) : null;
      lastClick = { element, at: Date.now() };
    },
    true,
  );
}

function findOpener() {
  const { element, at } = lastClick;
  if (element?.isConnected && Date.now() - at < CLICK_OPENS_WITHIN_MS) return element;
  return document.activeElement;
}

/**
 * Keeps keyboard focus inside `ref` while `active` (a modal dialog or the
 * navigation drawer):
 * - on activation, focuses the `[autofocus]` element, else the first
 *   focusable one inside `initialFocusRef` (or the container), else the container;
 * - Tab and Shift+Tab wrap around; Escape calls `onEscape`;
 * - on deactivation, focus returns to the element that had it before (or the
 *   control clicked to open it, see above), unless something else already
 *   took it (for example the page after a navigation).
 */
export function useFocusTrap(ref, active, { onEscape, initialFocusRef } = {}) {
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const container = ref.current;
    const opener = findOpener();
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
