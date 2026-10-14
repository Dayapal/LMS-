import { lazy, Suspense } from 'react';

const MarkdownView = lazy(() =>
  import('./MarkdownView.jsx').then((module) => ({ default: module.MarkdownView })),
);

/**
 * MarkdownView loaded on demand, for pages outside the lesson reader. The
 * plain text shows briefly while the Markdown renderer loads.
 */
export function LazyMarkdownView({ children, className = '', ...props }) {
  return (
    <Suspense
      fallback={<div className={`markdown whitespace-pre-line ${className}`}>{children}</div>}
    >
      <MarkdownView className={className} {...props}>
        {children}
      </MarkdownView>
    </Suspense>
  );
}
