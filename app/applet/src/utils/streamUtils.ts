export const formatStreamUrl = (url: string): string => {
  if (!url) return '';
  // Point to our internal proxy endpoint, which works both on
  // local development (via server.ts) and Vercel (via Edge Function).
  const proxyUrl = '/api/proxy?url=';
  
  // If already proxied, or local, return as-is
  if (url.startsWith('/api/proxy') || url.startsWith('/') || url.startsWith('blob:')) {
    return url;
  }
  
  return `${proxyUrl}${encodeURIComponent(url)}`;
};
