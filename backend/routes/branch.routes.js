import express from 'express';

const actorId = (req) => req.user?._id || req.user?.id || null;
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isAgentUser = (req) => req.user?.role === 'agent' || req.user?.role_id?.name === 'agent';
const managementOnly = (req, res, next) => isAgentUser(req)
  ? res.status(403).json({ success: false, message: 'No tienes permisos para administrar la configuración de sucursales.' })
  : next();

const friendlyErrorMessage = (error) => {
  const value = String(error?.message || '');
  if (value === 'Branch name is required') return 'El nombre de la sucursal es obligatorio.';
  if (value === 'Branch is not available') return 'La sucursal no está disponible.';
  if (value === 'Agent is not available in this workspace' || value === 'Agent is not available for this branch') return 'El agente seleccionado no está disponible para esta sucursal.';
  if (value === 'Select an AI model in AllSender settings before enabling the branch agent') return 'Selecciona primero un modelo en los Ajustes de IA.';
  if (value === 'Add the customer AI API key in AllSender settings before enabling the branch agent') return 'Configura primero la clave del proveedor en los Ajustes de IA.';
  if (value === 'The configured AI model is not available') return 'El modelo configurado en Ajustes de IA no está disponible.';
  if (value === 'Branch agent model must use the AI model configured in AllSender settings') return 'El agente debe usar el mismo modelo configurado en los Ajustes de IA.';
  if (value === 'Integration credentials are required' || value === 'Configure integration encryption before saving credentials') return 'Completa la autenticación segura de la integración.';
  if (value.startsWith('Integration URL') || value.startsWith('Integration operation')) return 'La URL o la operación de esta integración no está permitida.';
  if (value.includes('integration header') || value.includes('Sensitive integration headers')) return 'Configura las credenciales en el campo seguro de autenticación, no en los encabezados generales.';
  if (value === 'Branch API scope is not supported') return 'Los permisos seleccionados para la API no son válidos.';
  return 'No se pudo completar la operación.';
};

export function createBranchRouter({ branchService, resolver, agentRuntime, handoffService, apiKeyService, openApiImportService, host }) {
  const router = express.Router();
  router.get('/', asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.list(req.branchWorkspaceId) })));
  router.post('/', managementOnly, asyncRoute(async (req, res) => res.status(201).json({ success: true, data: await branchService.create(req.branchWorkspaceId, req.body, actorId(req)) })));
  router.post('/resolve', asyncRoute(async (req, res) => res.json({ success: true, data: await resolver.resolve({ workspaceId: req.branchWorkspaceId, ...req.body }) })));
  router.get('/:id', asyncRoute(async (req, res) => { const data = await branchService.get(req.branchWorkspaceId, req.params.id); if (!data) return res.status(404).json({ success: false, message: 'Sucursal no encontrada.' }); return res.json({ success: true, data }); }));
  router.patch('/:id', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.update(req.branchWorkspaceId, req.params.id, req.body, actorId(req)) })));
  router.delete('/:id', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.archive(req.branchWorkspaceId, req.params.id) })));

  router.get('/:id/members', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.listMembers(req.branchWorkspaceId, req.params.id) })));
  router.post('/:id/members', managementOnly, asyncRoute(async (req, res) => { await host.validateUser({ workspaceId: req.branchWorkspaceId, userId: req.body.user_id }); return res.status(201).json({ success: true, data: await branchService.upsertMember(req.branchWorkspaceId, req.params.id, req.body) }); }));
  router.patch('/:id/members/:userId', managementOnly, asyncRoute(async (req, res) => { await host.validateUser({ workspaceId: req.branchWorkspaceId, userId: req.params.userId }); return res.json({ success: true, data: await branchService.upsertMember(req.branchWorkspaceId, req.params.id, { ...req.body, user_id: req.params.userId }) }); }));
  router.delete('/:id/members/:userId', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.removeMember(req.branchWorkspaceId, req.params.id, req.params.userId) })));

  router.get('/:id/agents', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.listAgents(req.branchWorkspaceId, req.params.id) })));
  router.post('/:id/agents', managementOnly, asyncRoute(async (req, res) => res.status(201).json({ success: true, data: await branchService.createAgent(req.branchWorkspaceId, req.params.id, req.body) })));
  router.patch('/:id/agents/:agentId', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.updateAgent(req.branchWorkspaceId, req.params.id, req.params.agentId, req.body) })));
  router.delete('/:id/agents/:agentId', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.archiveAgent(req.branchWorkspaceId, req.params.id, req.params.agentId) })));
  router.post('/:id/agents/respond', managementOnly, asyncRoute(async (req, res) => { const result = await agentRuntime.respond({ workspaceId: req.branchWorkspaceId, branchId: req.params.id, ...req.body }); return res.status(result.blocked ? 409 : 200).json({ success: !result.blocked, data: result, ...(result.blocked ? { message: 'La conversación está siendo atendida por otro responsable.' } : {}) }); }));

  router.get('/:id/knowledge', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.listKnowledge(req.branchWorkspaceId, req.params.id) })));
  router.post('/:id/knowledge', managementOnly, asyncRoute(async (req, res) => res.status(201).json({ success: true, data: await branchService.createKnowledge(req.branchWorkspaceId, req.params.id, req.body) })));

  router.get('/:id/integrations', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.listIntegrations(req.branchWorkspaceId, req.params.id) })));
  router.post('/:id/integrations', managementOnly, asyncRoute(async (req, res) => res.status(201).json({ success: true, data: await branchService.createIntegration(req.branchWorkspaceId, req.params.id, req.body) })));
  router.patch('/:id/integrations/:integrationId', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.updateIntegration(req.branchWorkspaceId, req.params.id, req.params.integrationId, req.body) })));
  router.delete('/:id/integrations/:integrationId', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.archiveIntegration(req.branchWorkspaceId, req.params.id, req.params.integrationId) })));
  router.post('/:id/integrations/import-openapi', managementOnly, asyncRoute(async (req, res) => {
    const parsed = openApiImportService.parse(req.body?.document || req.body);
    if (!parsed.base_url && !req.body?.base_url) return res.status(400).json({ success: false, message: 'Indica la URL base de la integración.' });
    const data = await branchService.createIntegration(req.branchWorkspaceId, req.params.id, {
      name: req.body?.name || parsed.title,
      code: req.body?.code || String(req.body?.name || parsed.title).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      base_url: req.body?.base_url || parsed.base_url,
      auth_type: req.body?.auth_type || 'none', auth_meta: req.body?.auth_meta || {}, secret: req.body?.secret || null,
      operations: parsed.operations, status: 'active'
    });
    return res.status(201).json({ success: true, data, message: 'API importada. Revisa y activa únicamente las operaciones necesarias.' });
  }));

  router.get('/:id/handoffs', asyncRoute(async (req, res) => res.json({ success: true, data: await handoffService.queue({ workspaceId: req.branchWorkspaceId, branchId: req.params.id, language: req.query.language || null, viewerUserId: actorId(req), requireMembership: isAgentUser(req) }) })));
  router.post('/handoffs/:handoffId/claim', asyncRoute(async (req, res) => { const userId = actorId(req); if (!userId) return res.status(401).json({ success: false, message: 'Sesión requerida.' }); const result = await handoffService.claim({ workspaceId: req.branchWorkspaceId, handoffId: req.params.handoffId, userId }); return res.status(result.claimed ? 200 : 409).json({ success: result.claimed, data: result, message: result.claimed ? 'Conversación asignada.' : 'La conversación ya fue tomada por otro agente.' }); }));

  router.get('/:id/api-keys', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await branchService.listApiKeys(req.branchWorkspaceId, req.params.id) })));
  router.post('/:id/api-keys', managementOnly, asyncRoute(async (req, res) => {
    await branchService.assertBranch(req.branchWorkspaceId, req.params.id);
    const result = await apiKeyService.create({ workspaceId: req.branchWorkspaceId, branchId: req.params.id, name: req.body.name || 'Branch API', scopes: req.body.scopes || ['branch.read'], expiresAt: req.body.expires_at || null, actorId: actorId(req), ipAllowlist: req.body.ip_allowlist || [], rateLimitPerMinute: req.body.rate_limit_per_minute || 120 });
    return res.status(201).json({ success: true, data: { ...result.record, key_hash: undefined, key: result.key }, message: 'Guarda esta clave ahora. No volverá a mostrarse.' });
  }));
  router.delete('/api-keys/:keyId', managementOnly, asyncRoute(async (req, res) => res.json({ success: true, data: await apiKeyService.revoke({ workspaceId: req.branchWorkspaceId, keyId: req.params.keyId }) })));

  router.use((error, req, res, next) => { console.error('[branches]', error); if (res.headersSent) return next(error); return res.status(400).json({ success: false, message: friendlyErrorMessage(error) }); });
  return router;
}
