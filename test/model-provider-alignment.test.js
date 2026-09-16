import test from 'node:test';
import assert from 'node:assert/strict';
import { createAllSenderBranchesHostAdapter } from '../backend/integration/allSenderHostAdapter.js';

const leanResult = (value) => ({ select() { return { async lean() { return value; } }; } });

test('branch runtime cannot pair a different model with the global customer API key', async () => {
  const ownerId = '507f1f77bcf86cd799439011';
  const workspaceId = '507f191e810c19729de860ea';
  const configuredModelId = '507f191e810c19729de860eb';
  const differentModelId = '507f191e810c19729de860ec';
  const models = {
    Workspace: { findOne: () => leanResult({ user_id: ownerId }) },
    User: {},
    UserSetting: { findOne: () => leanResult({ ai_model: configuredModelId, api_key: 'customer-key' }) },
    AIModel: { findOne: () => leanResult({ _id: configuredModelId, provider: 'openai', model_id: 'test', status: 'active' }) },
    ChatAssignment: {}
  };
  const host = createAllSenderBranchesHostAdapter({ models, integrationEncryptionKey: 'test-secret' });
  await assert.rejects(() => host.resolveCustomerAI({ workspaceId, modelId: differentModelId }), /must use the AI model configured/);
});
