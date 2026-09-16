import test from 'node:test';
import assert from 'node:assert/strict';
import service from '../backend/services/openapi.service.js';

test('OpenAPI importer enables reads and disables writes by default', () => {
  const result = service.parse({ openapi: '3.0.0', info: { title: 'ERP', version: '1' }, servers: [{ url: 'https://erp.example.com/api' }], paths: { '/orders/{id}': { get: { operationId: 'getOrder' }, delete: { operationId: 'deleteOrder' } } } });
  const read = result.operations.find((op) => op.code === 'getorder');
  const write = result.operations.find((op) => op.code === 'deleteorder');
  assert.equal(read.enabled, true); assert.equal(read.read_only, true); assert.equal(write.enabled, false); assert.equal(write.read_only, false);
});
