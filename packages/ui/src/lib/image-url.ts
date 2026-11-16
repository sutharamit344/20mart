/** Keep local uploaded media same-origin in both apps, regardless of which dev port is open. */
export function resolveImageSrc(src?: string | null): string {
  if (!src) return '';
  try {
    const url = new URL(src, 'http://20mart.invalid');
    const isLocalHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
    if (isLocalHost && url.pathname.startsWith('/media/')) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // Leave unsupported or relative values unchanged; the browser will resolve them normally.
  }
  return src;
}
