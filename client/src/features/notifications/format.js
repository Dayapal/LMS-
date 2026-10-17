/** Only in-app paths are followed (the server builds them; this is a second check). */
export const safeLink = (link) =>
  typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : null;

export const badgeText = (count) => (count > 9 ? '9+' : String(count));

export const bellLabel = (count) => (count ? `Notifications, ${count} unread` : 'Notifications');
