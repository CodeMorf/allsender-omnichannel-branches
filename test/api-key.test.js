import test from 'node:test';
import assert from 'node:assert/strict';
import { BranchApiKeyService } from '../backend/services/api-key.service.js';

test('rejects unsupported branch API scopes', async () => {
  const BranchApiKey = { create: async () => { throw new Error('should not create'); } };
  const service = new BranchApiKeyService({ BranchApiKey });
  await assert.rejects(() => service.create({ workspaceId: 'w', branchId: 'b', name: 'test', scopes: ['root.admin'] }), /scope is not supported/);
});

test('enforces exact IP allowlist and per-minute limit', async () => {
  const record = {
    key_hash: 'hash',
    scopes: ['branch.read'],
    ip_allowlist: ['203.0.113.10'],
    rate_limit_per_minute: 1,
    expires_at: null,
    revoked_at: null,
    async save() {}
  };
  const BranchApiKey = { findOne: async () => record };
  const service = new BranchApiKeyService({ BranchApiKey });

  assert.equal(await service.authenticate('asb_demo.secret', 'branch.read', '203.0.113.11'), null);
  assert.equal(await service.authenticate('asb_demo.secret', 'branch.read', '203.0.113.10'), record);
  assert.equal(await service.authenticate('asb_demo.secret', 'branch.read', '203.0.113.10'), null);
});
