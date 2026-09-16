import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntegrationSecretCodec } from '../backend/integration/secretCodec.js';

test('integration secrets round trip with authenticated encryption', async () => { const codec = createIntegrationSecretCodec('unit-test-secret'); const encrypted = await codec.encrypt('abc123'); assert.notEqual(encrypted, 'abc123'); assert.equal(await codec.decrypt(encrypted), 'abc123'); });
