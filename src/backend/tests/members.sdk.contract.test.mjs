import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { members } from '@wix/members';
import { mocks } from './loader.mjs';

const BACKEND_MEMBER_MODULES = [
  '../reservas.web.js',
  '../citasManager.web.js',
  '../security.js',
  '../security.web.js',
  '../horario.web.js',
];

test('MEMBER-SDK-01 backend modules use the documented @wix/members namespace', async () => {
  for (const relativePath of BACKEND_MEMBER_MODULES) {
    const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
    assert.match(
      source,
      /import\s+\{\s*members\s*\}\s+from\s+["']@wix\/members["']/,
      `${relativePath} must import members from @wix/members`,
    );
    assert.match(
      source,
      /members\.getCurrentMember\s*\(/,
      `${relativePath} must call members.getCurrentMember()`,
    );
    assert.doesNotMatch(
      source,
      /currentMember\.getMember\s*\(|import\s+\{\s*currentMember\s*\}\s+from\s+["']@wix\/members["']/,
      `${relativePath} must not use the frontend Current Member namespace from @wix/members`,
    );
  }
});

test('MEMBER-SDK-02 loader mirrors the direct Get My Member response', async () => {
  const previous = mocks.members._current;
  const fixture = {
    _id: '11111111-1111-4111-8111-111111111111',
    contactId: '22222222-2222-4222-8222-222222222222',
    loginEmail: 'member.qa@example.test',
  };

  try {
    mocks.members._current = fixture;
    assert.strictEqual(await members.getCurrentMember(), fixture);
    mocks.members._current = null;
    assert.equal(await members.getCurrentMember(), null);
  } finally {
    mocks.members._current = previous;
  }
});
