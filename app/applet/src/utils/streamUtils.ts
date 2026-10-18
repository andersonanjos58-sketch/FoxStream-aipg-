export const formatStreamUrl = (url: string): string => {
  if (!url) return '';
  const proxyUrl = 'https://corsproxy.io/?';
  if (url.startsWith(proxyUrl) || url.startsWith('/') || url.startsWith('blob:')) {
    return url;
  }
  return `${proxyUrl}${encodeURIComponent(url)}`;
};
