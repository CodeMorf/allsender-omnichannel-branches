import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeIntegrationUrl, validateIntegrationUrlShape } from '../backend/services/integration.service.js';

test('rejects non-http integration protocols', () => {
  assert.throws(() => validateIntegrationUrlShape('file:///etc/passwd'), /HTTP or HTTPS/);
});

test('rejects credentials embedded in integration URLs', () => {
  assert.throws(() => validateIntegrationUrlShape('https://user:secret@example.com/api'), /embedded credentials/);
});

test('rejects localhost integration targets', () => {
  assert.throws(() => validateIntegrationUrlShape('http://localhost:3000/private'), /private host/);
});

test('rejects private IPv4 integration targets', async () => {
  await assert.rejects(() => assertSafeIntegrationUrl('http://169.254.169.254/latest/meta-data'), /private network/);
  await assert.rejects(() => assertSafeIntegrationUrl('http://10.0.0.5/internal'), /private network/);
  await assert.rejects(() => assertSafeIntegrationUrl('http://127.0.0.1/admin'), /private network/);
});
