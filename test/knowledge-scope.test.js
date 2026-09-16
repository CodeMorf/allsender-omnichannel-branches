import test from 'node:test';
import assert from 'node:assert/strict';
import { BranchAgentRuntime } from '../backend/services/agent-runtime.service.js';

test('knowledge fallback keeps workspace and branch visibility filters', async () => {
  const queries = [];
  const Knowledge = {
    find(query) {
      queries.push(query);
      const chain = {
        sort() { return chain; },
        limit() { return chain; },
        async lean() {
          if (queries.length === 1) throw new Error('text index unavailable');
          return [];
        }
      };
      return chain;
    }
  };
  const runtime = new BranchAgentRuntime({ models: { Knowledge } });
  await runtime.searchKnowledge({ workspaceId: 'workspace-a', branchId: 'branch-a', query: 'refund policy', language: 'en' });
  assert.equal(queries.length, 2);
  const fallback = queries[1];
  assert.equal(fallback.workspace_id, 'workspace-a');
  assert.equal(fallback.$and[0].$or[0].scope, 'workspace');
  assert.equal(fallback.$and[0].$or[1].branch_id, 'branch-a');
  assert.ok(fallback.$and[1].$or.some((entry) => entry.title));
  assert.ok(fallback.$and[1].$or.some((entry) => entry.content));
});
