import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimiter, _resetRateLimitCacheForTests } from '../security.js';

test('SEC-RL-01 applies the configured sliding-window limit per surface and key', () => {
  _resetRateLimitCacheForTests();
  const key = { surface: 'security.test', key: 'requester-a' };

  assert.deepEqual(rateLimiter(key, 2, 10000), { allowed: true, retryAfter: 0 });
  assert.deepEqual(rateLimiter(key, 2, 10000), { allowed: true, retryAfter: 0 });

  const blocked = rateLimiter(key, 2, 10000);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfter >= 1);
});

test('SEC-RL-02 isolates requesters and surfaces', () => {
  _resetRateLimitCacheForTests();

  assert.equal(rateLimiter({ surface: 'security.test', key: 'requester-a' }, 1, 10000).allowed, true);
  assert.equal(rateLimiter({ surface: 'security.test', key: 'requester-a' }, 1, 10000).allowed, false);
  assert.equal(rateLimiter({ surface: 'security.test', key: 'requester-b' }, 1, 10000).allowed, true);
  assert.equal(rateLimiter({ surface: 'other.test', key: 'requester-a' }, 1, 10000).allowed, true);
});

test('SEC-RL-03 test reset clears the in-memory limiter state', () => {
  _resetRateLimitCacheForTests();
  const key = { surface: 'security.test', key: 'requester-reset' };

  assert.equal(rateLimiter(key, 1, 10000).allowed, true);
  assert.equal(rateLimiter(key, 1, 10000).allowed, false);

  _resetRateLimitCacheForTests();
  assert.equal(rateLimiter(key, 1, 10000).allowed, true);
});
