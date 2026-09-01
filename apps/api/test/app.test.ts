import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('Smart Path Platform HTTP baseline', () => {
  it('reports the rebranded product health status', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { status: 'ok', product: 'Smart Path Platform' } });
  });

  it('accepts the Vite development server CORS preflight', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'OPTIONS', url: '/api/v1/public/school-requests', headers: { origin: 'http://127.0.0.1:5176', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5176');
  });

  it('accepts the alternate Vite origin on port 5177', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'OPTIONS', url: '/api/v1/public/school-requests', headers: { origin: 'http://127.0.0.1:5177', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5177');
  });

  it('reports an anonymous session without treating it as an API error', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/session' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { user: null } });
  });
});
