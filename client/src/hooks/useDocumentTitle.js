import { useEffect } from 'react';
import { useMatches } from 'react-router';

export const APP_NAME = 'Training LMS';

/** Names the browser tab after the deepest route with a `handle.title`. */
export function useDocumentTitle() {
  const matches = useMatches();
  const title = matches.findLast((match) => match.handle?.title)?.handle.title;
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
