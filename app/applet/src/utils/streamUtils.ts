/**
 * Utility function to format and proxy stream URLs.
 * IPTV streams often have CORS restrictions or Mixed Content issues
 * (HTTP streams on HTTPS sites). A proxy ensures the request is
 * mediated through an HTTPS endpoint.
 */
export const formatStreamUrl = (url: string): string => {
  if (!url) return '';
  
  // Using a public CORS proxy service for transparent stream access.
  // Note: For production-grade IPTV apps, consider a private backend proxy.
  const proxyUrl = 'https://corsproxy.io/?';
  
  // If the URL already seems to be proxied or is a local asset, return as is.
  if (url.startsWith(proxyUrl) || url.startsWith('/') || url.startsWith('blob:')) {
    return url;
  }
  
  // Encode the URL to ensure special characters in M3U8 query strings don't break the proxy request.
  return `${proxyUrl}${encodeURIComponent(url)}`;
};
