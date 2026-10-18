/** Only in-app paths are followed (the server builds them; this is a second check). */
export const safeLink = (link) =>
  typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : null;

export const badgeText = (count) => (count > 99 ? '99+' : String(count));

// The name repeats the badge's visible text, so voice control matches what is
// shown (WCAG 2.5.3, label in name).
export const bellLabel = (count) =>
  count ? `Notifications, ${badgeText(count)} unread` : 'Notifications';
