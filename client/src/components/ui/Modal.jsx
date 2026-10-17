import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../Icon.jsx';
import { useFocusTrap } from '../../hooks/useFocusTrap.js';

/**
 * Accessible modal dialog: traps focus, closes on Escape or backdrop click,
 * and returns focus to the element that opened it.
 */
export function Modal({ open, onClose, title, description, size = 'md', children }) {
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useFocusTrap(panelRef, open, { onEscape: onClose, initialFocusRef: bodyRef });

  useEffect(() => {
    if (!open) return undefined;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  if (!open) return null;

  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-5xl' }[size];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/50" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full ${width} flex-col rounded-t-xl bg-white shadow-xl focus:outline-none sm:rounded-xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close dialog"
          >
            <Icon name="close" />
          </button>
        </div>
        <div ref={bodyRef} className="overflow-y-auto px-5 py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
