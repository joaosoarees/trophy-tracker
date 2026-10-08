/** `epoch` in seconds, as Steam reports it. */
export function formatDate(epoch: number, locale: string): string {
  return new Date(epoch * 1000).toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatNumber(value: number, locale: string): string {
  return value.toLocaleString(locale);
}

export function formatPercent(value: number, locale: string): string {
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
}

/** Hours and minutes; the unit symbols are the same in every language the app has. */
export function formatPlaytime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
