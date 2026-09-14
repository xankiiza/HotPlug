import test from'node:test';import assert from'node:assert/strict';import{ProviderSessionManager}from'../server/provider-sessions.js';
test('rejects unknown providers without opening a browser',async()=>{const manager=new ProviderSessionManager();await assert.rejects(()=>manager.openLogin('unknown'),/Unsupported provider/)});
