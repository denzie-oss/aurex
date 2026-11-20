process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

let server, base;
test.before(async () => {
  await new Promise(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});
test.after(async () => { await new Promise(r => server.close(r)); });

test('protected routes reject missing tokens', async () => {
  const res = await fetch(`${base}/wallet`);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, 'AUTH_REQUIRED');
});
test('protected routes reject forged tokens', async () => {
  const res = await fetch(`${base}/wallet`, { headers: { Authorization: 'Bearer abc.def.ghi' } });
  assert.equal(res.status, 401);
});
test('unknown API routes return JSON 404', async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
});
test('register validates input', async () => {
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'bad' })
  });
  assert.equal(res.status, 400);
});
