/** Beyond this the text is not an address someone pasted. */
const MAX_LENGTH = 2000;

/**
 * The address a typed or pasted text stands for, or `null` when it is not one
 * the app keeps and opens: only `https`, a host with a dot in it, and no user
 * or password. An address with no scheme (`youtu.be/abc`) is taken as `https`.
 * Checked in the card as it is typed and in the main process before it opens.
 */
export function parseLink(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === '' || trimmed.length > MAX_LENGTH || /\s/.test(trimmed)) {
    return null;
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  let url: URL;
  try {
    url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const isKept =
    url.protocol === 'https:' &&
    url.username === '' &&
    url.password === '' &&
    /^[^.]+(\.[^.]+)+$/.test(url.hostname);
  return isKept ? url.href : null;
}

/** Where a kept link leads, as the card names it: the host without `www.`. */
export function linkHost(link: string): string {
  return new URL(link).hostname.replace(/^www\./, '');
}
