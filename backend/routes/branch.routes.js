import express from 'express';

const actorId = (req) => req.user?._id || req.user?.id || null;
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const SAFE_MESSAGES = new Set(['Branch name is required','Agent is not available in this workspace','Select an AI model in AllSender settings before enabling the branch agent','Add the customer AI API key in AllSender settings before enabling the branch agent','The configured AI model is not available']);

export function createBranchRouter({ branchService, resolver, agentRuntime, handoffService, apiKeyService, openApiImportService, Integration, host }) {
  const router = express.Router();
  router.get('/', asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.list(req.branchWorkspaceId) })));
  router.post('/', asyncRoute(async (req, res) => res.status(201).json({ success: true, data: await branchService.create(req.branchWorkspaceId, req.body, actorId(req)) })));
  router.post('/resolve', asyncRoute(async (req, res) => res.json({ success: true, data: await resolver.resolve({ workspaceId: req.branchWorkspaceId, ...req.body }) })));
  router.get('/:id', asyncRoute(async (req, res) => { const data = await branchService.get(req.branchWorkspaceId, req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Sucursal no encontrada.' }); return res.json({ success: true, data }); }));
  router.patch('/:id', asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.update(req.branchWorkspaceId, req.params.id, req.body, actorId(req)) })));
  router.delete('/:id', asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.archive(req.branchWorkspaceId, req.params.id) })));
  router.get('/:id/members', asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.listMembers(req.branchWorkspaceId, req.params.id) })));
  router.post('/:id/members', asyncRoute(async (req, res) => { await host.validateUser({ workspaceId: req.branchWorkspaceId, userId: req.body.user_id }); return res.status(201).json({ success: true, data: await branchService.upsertMember(req.branchWorkspaceId, req.params.id, req.body) }); }));
  router.get('/:id/agents', asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.listAgents(req.branchWorkspaceId, req.params.id) })));
  router.post('/:id/agents', asyncRoute(async (req, res) => res.status(201).json({ success: true, data: await branchService.createAgent(req.branchWorkspaceId, req.params.id, req.body) })));
  router.post('/:id/agents/respond', asyncRoute(async (req, res) => { const result = await agentRuntime.respond({ workspaceId: req.branchWorkspaceId, branchId: req.params.id, ...req.body }); return res.status(result.blocked ? 409 : 200).json({ success: !result.blocked, data: result, ...(result.blocked ? { message: 'La conversación está siendo atendida por otro responsable.' } : {}) }); }));
  router.get('/:id/knowledge', asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.listKnowledge(req.branchWorkspaceId, req.params.id) })));
  router.post('/:id/knowledge', asyncRoute(async (req, res) => res.status(201).json({ success: true, data: await branchService.createKnowledge(req.branchWorkspaceId, req.params.id, req.body) })));
  router.get('/:id/integrations', asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.listIntegrations(req.branchWorkspaceId, req.params.id) })));
  router.post('/:id/integrations', asyncRoute(async (req, res) => res.status(201).json({ success: true, data: await branchService.createIntegration(req.branchWorkspaceId, req.params.id, req.body) })));
  router.post('/:id/integrations/import-openapi', asyncRoute(async (req, res) => {
    const parsed = openApiImportService.parse(req.body?.document || req.body);
    if (!parsed.base_url && !req.body?.base_url) return res.status(400).json({ success: false, message: 'Indica la URL base de la integración.' });
    const data = await Integration.create({ workspace_id: req.branchWorkspaceId, branch_id: req.params.id, name: req.body?.name || parsed.title, code: req.body?.code || String(req.body?.name || parsed.title).toLowerCase().replace(/[^a-z0-9]+/g, '-'), base_url: req.body?.base_url || parsed.base_url, auth_type: 'none', operations: parsed.operations, status: 'active' });
    return res.status(201).json({ success: true, data, message: 'API importada. Revisa y activa únicamente las operaciones necesarias.' });
  }));
  router.get('/:id/handoffs', asyncRoute(async (req, res) => res.json({ success: true, data: await handoffService.queue({ workspaceId: req.branchWorkspaceId, branchId: req.params.id, language: req.query.language || null }) })));
  router.post('/handoffs/:handoffId/claim', asyncRoute(async (req, res) => { const userId = actorId(req); if (!userId) return res.status(401).json({ success: false, message: 'Sesión requerida.' }); const result = await handoffService.claim({ workspaceId: req.branchWorkspaceId, handoffId: req.params.handoffId, userId }); return res.status(result.claimed ? 200 : 409).json({ success: result.claimed, data: result, message: result.claimed ? 'Conversación asignada.' : 'La conversación ya fue tomada por otro agente.' }); }));
  router.post('/:id/api-keys', asyncRoute(async (req, res) => { const result = await apiKeyService.create({ workspaceId: req.branchWorkspaceId, branchId: req.params.id, name: req.body.name || 'Branch API', scopes: req.body.scopes || ['branch.read'], expiresAt: req.body.expires_at || null, actorId: actorId(req) }); return res.status(201).json({ success: true, data: { ...result.record, key: result.key }, message: 'Guarda esta clave ahora. No volverá a mostrarse.' }); }));
  router.delete('/api-keys/:keyId', asyncRoute(async (req, res) => res.json({ success: true, data: await apiKeyService.revoke({ workspaceId: req.branchWorkspaceId, keyId: req.params.keyId }) })));
  router.use((error, req, res, next) => { console.error('[branches]', error); if (res.headersSent) return next(error); const message = SAFE_MESSAGES.has(error?.message) ? error.message : 'No se pudo completar la operación.'; return res.status(400).json({ success: false, message }); });
  return router;
}
