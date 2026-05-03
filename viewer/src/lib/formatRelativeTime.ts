export function formatRelativeTime(mtime: number): string {
  const diff = Date.now() - mtime;
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes}min`;
  if (hours < 24) return `hace ${hours}h`;
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}
