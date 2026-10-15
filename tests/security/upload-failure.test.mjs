import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../supabase/functions/package-upload-box-asset/index.ts', import.meta.url), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import[^\n]+\n/, ''));
const assetId = '10000000-0000-4000-8000-000000000001';
function setup({ reserveError, uploadError, readyError, ready = false, unauthenticated = false } = {}) {
  const mutations = [];
  const row = { id: assetId, user_id: reserveError ? 'another-user' : 'current-user', status: ready ? 'ready' : 'pending' };
  const files = new Set(uploadError || ready ? ['current-user/' + assetId + '.png'] : []);
  const storage = {
    async upload(path, _file, options) {
      mutations.push(['upload', path, options]);
      if (!uploadError) files.add(path);
      return { error: uploadError };
    },
    async remove(paths) { mutations.push(['remove', paths]); paths.forEach(p => files.delete(p)); return {}; },
  };
  const query = {
    update(value) { mutations.push(['update', value]); return this; },
    delete() { mutations.push(['delete']); return this; },
    eq(key, value) { mutations.push(['eq', key, value]); return this; },
    select() { return this; },
    async single() { if (!readyError) row.status = 'ready'; return {data: {...row}, error: readyError}; },
  };
  const packageAdmin = {
    async rpc() { return { data: {...row}, error: reserveError }; },
    from() { return query; },
  };
  const admin = { storage: { from: () => storage }, schema: () => packageAdmin };
  let handler;
  runInNewContext(executable, {
    Deno: { serve(fn) { handler = fn; } }, File, Response, Error, Uint8Array,
    authenticatedUser: async () => { if (unauthenticated) throw new Error('AUTH_REQUIRED'); return { user: { id: 'current-user' }, admin, packageAdmin }; },
    clients: () => ({ admin }), corsHeaders: () => ({}),
    json: (_request, value, status = 200) => Response.json(value, {status}),
    PACKAGE_BOX_ASSETS_BUCKET: 'package-box-assets', PACKAGE_SCHEMA: 'package', safeFileName: v => v,
  });
  const form = new FormData();
  form.set('file', new File([new Uint8Array([137,80,78,71,13,10,26,10,0])], 'test.png', {type:'image/png'}));
  form.set('assetId', assetId); form.set('aspectRatio','1'); form.set('sourceType','png');
  return { run: () => handler(new Request('https://example.invalid/upload', {method:'POST',body:form})), mutations, row, files };
}
for (const [name, options] of [
  ['another user reservation collision', {reserveError: {code:'23505'}}],
  ['quota failure', {reserveError: new Error('STORAGE_LIMIT_REACHED')}],
  ['concurrent upload conflict', {uploadError: {statusCode:'409'}}],
  ['upload response lost', {uploadError: new Error('network timeout')}],
  ['finalization response lost', {readyError: new Error('network timeout')}],
]) {
  test(name + ' must never delete rows or files', async () => {
    const s = setup(options); const before = new Set(s.files);
    assert.equal((await s.run()).status,400);
    assert.ok(!s.mutations.some(([op]) => op === 'delete' || op === 'remove'));
    for (const file of before) assert.ok(s.files.has(file));
    assert.equal(s.row.status,'pending');
  });
}
test('successful upload remains scoped to the authenticated owner', async () => {
  const s=setup(); const response=await s.run();
  assert.equal(response.status,200); assert.equal(s.row.status,'ready');
  assert.ok(s.mutations.some(([op,k,v])=>op==='eq' && k==='user_id' && v==='current-user'));
  assert.equal(s.mutations.find(([op])=>op==='upload')[2].upsert,false);
});
test('already ready reservation returns without upload or deletion',async()=>{
  const s=setup({ready:true});assert.equal((await s.run()).status,200);assert.equal(s.mutations.length,0);
});
test('unauthenticated request cannot mutate anything',async()=>{
  const s=setup({unauthenticated:true});assert.equal((await s.run()).status,401);assert.equal(s.mutations.length,0);
});
