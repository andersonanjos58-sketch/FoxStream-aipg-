export const config = { runtime: 'edge' };

export default async function handler(request: Request) {
  // CORS Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  const url = new URL(request.url).searchParams.get('url');
  if (!url) return new Response('Missing URL', { status: 400 });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Range': request.headers.get('Range') || '',
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Compatible; FoxStream/1.0)',
      },
      redirect: 'follow',
    });

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');

    // Return the response body directly (streaming)
    return new Response(response.body, {
      status: response.status,
      headers: headers,
    });
  } catch (e: any) {
    console.error('Edge Proxy Error:', e);
    return new Response('Proxy Error', { status: 500 });
  }
}
