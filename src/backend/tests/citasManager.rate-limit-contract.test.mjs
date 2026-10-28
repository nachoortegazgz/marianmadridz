import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const moduleSource = readFileSync(join(here, '..', 'citasManager.web.js'), 'utf8');

test('CM-RL-01 citasManager defines its rate-limit guard before use', () => {
  assert.match(moduleSource, /import\s*\{[^}]*\brateLimiter\b[^}]*\}\s*from\s*["']backend\/security["']/s);
  const declaration = moduleSource.indexOf('function _rateLimitOrThrow(');
  assert.notEqual(declaration, -1, 'rate-limit helper declaration must exist');
  const firstCall = moduleSource.indexOf('_rateLimitOrThrow(', declaration + 1);
  assert.notEqual(firstCall, -1, 'rate-limit helper must be used by public methods');
  assert.match(moduleSource.slice(declaration, declaration + 700), /rateLimiter\(\{\s*surface,\s*key\s*\}\)/);
  assert.match(moduleSource.slice(declaration, declaration + 700), /error\.code\s*=\s*["']RATE_LIMITED["']/);
});
