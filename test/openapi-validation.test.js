import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBranchPublicRouter } from '../backend/routes/branch-public.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const openapiPath = path.resolve(__dirname, '../openapi.json');

test('OpenAPI specification file exists and is valid OpenAPI 3.0', () => {
  assert.equal(fs.existsSync(openapiPath), true, 'openapi.json must exist');
  const spec = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
  assert.equal(spec.openapi.startsWith('3.0'), true, 'Must be OpenAPI 3.0.x');
  assert.ok(spec.info.title, 'Must have a title');
  assert.ok(spec.paths, 'Must have paths');
  assert.ok(spec.paths['/openapi.json'], 'Must declare /openapi.json');
  assert.ok(spec.paths['/profile'], 'Must declare /profile');
  assert.ok(spec.paths['/records/{type}'], 'Must declare /records/{type}');
  assert.ok(spec.paths['/records/{type}/{externalId}'], 'Must declare /records/{type}/{externalId}');
  assert.ok(spec.paths['/knowledge'], 'Must declare /knowledge');
  assert.ok(spec.paths['/knowledge/{externalRef}'], 'Must declare /knowledge/{externalRef}');
});

test('branch-public router registers all paths declared in OpenAPI spec', () => {
  const dummyApiKeyService = { authenticate: async () => null };
  const dummyExternalRecordService = {};
  const dummyBranch = {};
  const dummyKnowledge = {};
  
  const router = createBranchPublicRouter({
    apiKeyService: dummyApiKeyService,
    externalRecordService: dummyExternalRecordService,
    Branch: dummyBranch,
    Knowledge: dummyKnowledge
  });

  const registeredRoutes = router.stack
    .filter(layer => layer.route)
    .map(layer => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods)
    }));

  const registeredPaths = registeredRoutes.map(r => r.path);
  assert.ok(registeredPaths.includes('/openapi.json'), 'Router must expose /openapi.json');
  assert.ok(registeredPaths.includes('/profile'), 'Router must expose /profile');
  assert.ok(registeredPaths.includes('/records/:type'), 'Router must expose /records/:type');
  assert.ok(registeredPaths.includes('/records/:type/:externalId'), 'Router must expose /records/:type/:externalId');
  assert.ok(registeredPaths.includes('/knowledge'), 'Router must expose /knowledge');
  assert.ok(registeredPaths.includes('/knowledge/:externalRef'), 'Router must expose /knowledge/:externalRef');
});
