interface Env {
  API_ORIGIN?: string;
  CLIENT_IP_HMAC_SECRET?: string;
  ALLOW_HTTP_LOCAL_UPSTREAM?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const SAFE_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
  'host', 'forwarded', 'x-real-ip', 'x-client-ip', 'true-client-ip',
  'cf-connecting-ip', 'cf-connecting-ipv6', 'x-proxy-client-ip',
  'x-proxy-client-ip-timestamp', 'x-proxy-client-ip-signature',
]);

function isUntrustedHeader(name: string): boolean {
  const lowerName = name.toLowerCase();
  return SAFE_HEADERS.has(lowerName) || lowerName.startsWith('x-forwarded-') ||
    lowerName.startsWith('x-proxy-client-ip-');
}

const noStoreHeaders = (headers: Headers): Headers => {
  headers.set('Cache-Control', 'no-store');
  headers.set('Pragma', 'no-cache');
  return headers;
};

function problem(status: number, title: string): Response {
  return Response.json(
    { type: 'about:blank', title, status },
    { status, headers: noStoreHeaders(new Headers({ 'Content-Type': 'application/problem+json' })) },
  );
}

function decodeSecret(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    if (binary.length !== 32) return null;
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function isPlausibleIp(value: string): boolean {
  if (!value || value.length > 64 || value.trim() !== value) return false;
  if (/^[0-9.]+$/.test(value)) {
    const parts = value.split('.');
    return parts.length === 4 && parts.every((part) => {
      const number = Number(part);
      return /^\d{1,3}$/.test(part) && number >= 0 && number <= 255;
    });
  }
  return /^[0-9a-fA-F:]+$/.test(value) && value.includes(':');
}

async function signedHeaders(request: Request, env: Env): Promise<Headers | null> {
  if (!env.CLIENT_IP_HMAC_SECRET) return null;
  const secret = decodeSecret(env.CLIENT_IP_HMAC_SECRET);
  if (!secret) throw new Error('Invalid proxy configuration');

  const ip = request.headers.get('CF-Connecting-IP') ?? '';
  if (!isPlausibleIp(ip)) return null;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const path = new URL(request.url).pathname;
  const message = `v1\n${timestamp}\n${ip}\n${request.method.toUpperCase()}\n${path}`;
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  const hex = [...signature].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const headers = new Headers();
  headers.set('X-Proxy-Client-IP', ip);
  headers.set('X-Proxy-Client-IP-Timestamp', timestamp);
  headers.set('X-Proxy-Client-IP-Signature', hex);
  return headers;
}

export async function onRequest({ request, env }: PagesContext): Promise<Response> {
  const incoming = new URL(request.url);
  if (!['GET', 'POST', 'PATCH', 'OPTIONS'].includes(request.method.toUpperCase())) {
    return problem(405, 'Method Not Allowed');
  }

  let apiOrigin: URL;
  try {
    apiOrigin = new URL(env.API_ORIGIN ?? '');
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(apiOrigin.hostname);
    const localHttpAllowed = env.ALLOW_HTTP_LOCAL_UPSTREAM === 'true' && loopback;
    if ((apiOrigin.protocol !== 'https:' && !(apiOrigin.protocol === 'http:' && localHttpAllowed)) ||
        apiOrigin.username || apiOrigin.password || apiOrigin.pathname !== '/' || apiOrigin.search || apiOrigin.hash) {
      return problem(503, 'Service Unavailable');
    }
  } catch {
    return problem(503, 'Service Unavailable');
  }

  const target = new URL(incoming.pathname + incoming.search, apiOrigin.origin);
  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (!isUntrustedHeader(name)) headers.set(name, value);
  });

  try {
    const identityHeaders = await signedHeaders(request, env);
    identityHeaders?.forEach((value, name) => headers.set(name, value));
  } catch {
    return problem(503, 'Service Unavailable');
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'OPTIONS' ? undefined : request.body,
      redirect: 'manual',
      cf: { cacheTtl: 0, cacheEverything: false },
    });
  } catch {
    return problem(502, 'API Unavailable');
  }

  if (upstream.status >= 500) {
    const headers = noStoreHeaders(new Headers({ 'Content-Type': 'application/problem+json' }));
    const requestId = upstream.headers.get('X-Request-Id');
    if (requestId && /^[A-Za-z0-9_-]{1,100}$/.test(requestId)) headers.set('X-Request-Id', requestId);
    return Response.json({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: upstream.status,
      ...(requestId && /^[A-Za-z0-9_-]{1,100}$/.test(requestId) ? { requestId } : {}),
    }, { status: upstream.status, headers });
  }

  const responseHeaders = noStoreHeaders(new Headers(upstream.headers));
  const setCookies = upstream.headers.getSetCookie?.() ?? [];
  if (setCookies.length > 0) {
    responseHeaders.delete('set-cookie');
    for (const cookie of setCookies) responseHeaders.append('set-cookie', cookie);
  }
  const body = [204, 304].includes(upstream.status) ? null : upstream.body;
  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}
