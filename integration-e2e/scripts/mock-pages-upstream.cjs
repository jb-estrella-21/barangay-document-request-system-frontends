const http = require('node:http');

const port = Number(process.env.PHASE5B_MOCK_API_PORT || 5299);
let apiRequests = 0;

const server = http.createServer((request, response) => {
  if (request.url === '/__stats') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ apiRequests }));
    return;
  }
  if (!request.url?.startsWith('/api/v1/')) {
    response.writeHead(404);
    response.end();
    return;
  }
  apiRequests += 1;
  if (request.url.startsWith('/api/v1/_delay')) {
    const delay = Math.min(Number(new URL(request.url, 'http://localhost').searchParams.get('ms')) || 0, 5000);
    setTimeout(() => sendEcho(request, response), delay);
    return;
  }
  if (request.url === '/api/v1/_cookies') {
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': [
        'phase5b_http_only=first; Path=/api/v1/staff; HttpOnly; SameSite=Lax',
        'phase5b_secure=second; Path=/api/v1/staff; HttpOnly; Secure; SameSite=Lax',
      ],
      ETag: '"proxy-cookie-check"',
      'X-Request-Id': 'phase5b-request-123',
    });
    response.end(JSON.stringify({ ok: true }));
    return;
  }
  if (request.url === '/api/v1/_failure') {
    response.writeHead(500, { 'Content-Type': 'application/problem+json', 'X-Request-Id': 'phase5b-safe-error-id' });
    response.end(JSON.stringify({ type: 'about:blank', title: 'Sensitive internal failure', detail: 'do not expose this value' }));
    return;
  }
  if (request.url === '/api/v1/_drop') {
    request.socket.destroy();
    return;
  }
  sendEcho(request, response);
});

function sendEcho(request, response) {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const selected = {};
    for (const name of [
      'origin', 'cookie', 'x-csrf-token', 'idempotency-key', 'if-match',
      'x-proxy-client-ip', 'x-proxy-client-ip-timestamp', 'x-proxy-client-ip-signature',
      'x-forwarded-for', 'x-forwarded-port', 'x-forwarded-prefix',
      'forwarded', 'x-real-ip', 'true-client-ip', 'cf-connecting-ip',
    ]) selected[name] = request.headers[name] ?? null;
    response.writeHead(request.method === 'OPTIONS' ? 204 : 200, {
      'Content-Type': 'application/json',
      ETag: '"proxy-echo-v4"',
      'X-Request-Id': 'phase5b-request-123',
    });
    response.end(request.method === 'OPTIONS' ? undefined : JSON.stringify({
      method: request.method,
      url: request.url,
      headers: selected,
      body: Buffer.concat(chunks).toString('utf8'),
    }));
  });
}

server.listen(port, '127.0.0.1');
