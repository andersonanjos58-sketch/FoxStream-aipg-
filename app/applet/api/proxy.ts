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
    // Repassa cabeçalhos úteis e aplica o fallback de User-Agent anti-bloqueio
    const forwardHeaders = new Headers();
    ['range', 'user-agent', 'authorization', 'cookie'].forEach((header) => {
      const val = request.headers.get(header);
      if (val) {
        forwardHeaders.set(header, val);
      } else if (header === 'user-agent') {
        // IMPORTANTE: Evita bloqueios 403 Forbidden em servidores de IPTV rígidos
        forwardHeaders.set(
          'user-agent',
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
      }
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: forwardHeaders,
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
