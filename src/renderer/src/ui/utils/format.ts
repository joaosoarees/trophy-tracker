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
