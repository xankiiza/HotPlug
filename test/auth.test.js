import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthManager } from '../server/auth.js';

test('accepts configured admin credentials and rejects incorrect values', () => {
  const auth = new AuthManager();
  assert.equal(auth.validCredentials('xankiiza@gmail.com', 'Xankiiza123##1'), true);
  assert.equal(auth.validCredentials('xankiiza@gmail.com', 'wrong'), false);
  assert.equal(auth.validCredentials('other@example.com', 'Xankiiza123##1'), false);
});

test('creates, validates, and revokes a session cookie', () => {
  const auth = new AuthManager();
  const token = auth.createSession();
  const req = { headers: { cookie: `hotplug_session=${token}` } };
  assert.equal(auth.authenticated(req), true);
  auth.revoke(req);
  assert.equal(auth.authenticated(req), false);
});
