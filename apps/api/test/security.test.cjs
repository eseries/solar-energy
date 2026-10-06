const test = require('node:test');
const assert = require('node:assert/strict');
const { SensitiveRateLimitMiddleware } = require('../dist/common/rate-limit.middleware');

test('sensitive rate limiter returns 429 after the configured login budget', () => {
  const limiter = new SensitiveRateLimitMiddleware();
  const request = { path: '/api/auth/login', ip: 'test-client' };
  let calls = 0;
  const next = () => { calls += 1; };
  const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
  for (let i = 0; i < 10; i += 1) limiter.use(request, response, next);
  limiter.use(request, response, next);
  assert.equal(calls, 10);
  assert.equal(response.statusCode, 429);
  assert.equal(response.body.statusCode, 429);
});

test('non-sensitive routes pass through without limiting', () => {
  const limiter = new SensitiveRateLimitMiddleware();
  let calls = 0;
  limiter.use({ path: '/api/health', ip: 'test-client' }, {}, () => { calls += 1; });
  assert.equal(calls, 1);
});
