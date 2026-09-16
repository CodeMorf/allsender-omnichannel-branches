import express from 'express';

const extractKey = (req) => { const header = req.headers?.authorization; if (typeof header === 'string' && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim(); const direct = req.headers?.['x-branch-api-key']; return typeof direct === 'string' ? direct.trim() : null; };
const readScopeFor = (type) => type === 'order' ? 'branch.orders.read' : type === 'tracking' ? 'branch.tracking.read' : 'branch.data.read';
const writeScopeFor = (type) => type === 'order' ? 'branch.orders.write' : type === 'tracking' ? 'branch.tracking.write' : 'branch.data.write';

export function createBranchPublicRouter({ apiKeyService, externalRecordService, Branch, Knowledge }) {
  const router = express.Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  const authorize = (scopeResolver) => async (req, res, next) => {
    try {
      const scope = typeof scopeResolver === 'function' ? scopeResolver(req) : scopeResolver;
      const key = await apiKeyService.authenticate(extractKey(req), scope, req.ip || req.socket?.remoteAddress || null);
      if (!key) return res.status(401).json({ success: false, message: 'API key inválida, vencida, limitada o sin permisos.' });
      req.branchApiKey = key; req.branchWorkspaceId = key.workspace_id; req.branchId = key.branch_id;
      return next();
    } catch (error) {
      console.error('[branches:public-auth]', error);
      return res.status(401).json({ success: false, message: 'No se pudo validar la credencial.' });
    }
  };
  router.get('/profile', authorize('branch.read'), async (req, res) => { const branch = await Branch.findOne({ _id: req.branchId, workspace_id: req.branchWorkspaceId, deleted_at: null, status: 'active' }).select('name code description address location timezone languages default_language phone email coverage_mode status').lean(); if (!branch) return res.status(404).json({ success: false, message: 'Sucursal no disponible.' }); return res.json({ success: true, data: branch }); });
  router.get('/records/:type', authorize((req) => readScopeFor(req.params.type)), async (req, res) => res.json({ success: true, data: await externalRecordService.list({ workspaceId: req.branchWorkspaceId, branchId: req.branchId, type: req.params.type, limit: req.query.limit }) }));
  router.get('/records/:type/:externalId', authorize((req) => readScopeFor(req.params.type)), async (req, res) => { const data = await externalRecordService.get({ workspaceId: req.branchWorkspaceId, branchId: req.branchId, type: req.params.type, externalId: req.params.externalId }); if (!data) return res.status(404).json({ success: false, message: 'Registro no encontrado.' }); return res.json({ success: true, data }); });
  router.put('/records/:type/:externalId', authorize((req) => writeScopeFor(req.params.type)), async (req, res) => { const data = await externalRecordService.upsert({ workspaceId: req.branchWorkspaceId, branchId: req.branchId, type: req.params.type, externalId: req.params.externalId, payload: req.body?.payload ?? req.body, externalUpdatedAt: req.body?.external_updated_at, source: 'branch_api', customerRefs: req.body?.customer_refs || {}, accessMode: req.body?.access_mode || 'customer_bound' }); return res.json({ success: true, data }); });
  router.get('/knowledge', authorize('branch.knowledge.read'), async (req, res) => { const data = await Knowledge.find({ workspace_id: req.branchWorkspaceId, deleted_at: null, status: 'active', $or: [{ scope: 'workspace' }, { branch_id: req.branchId }] }).select('scope type title language country version effective_date content source_url updated_at').sort({ scope: 1, title: 1 }).lean(); return res.json({ success: true, data }); });
  router.post('/knowledge', authorize('branch.knowledge.write'), async (req, res) => { if (!req.body?.title) return res.status(400).json({ success: false, message: 'El título es obligatorio.' }); const data = await Knowledge.create({ workspace_id: req.branchWorkspaceId, branch_id: req.branchId, scope: 'branch', type: req.body.type || 'text', title: req.body.title, language: req.body.language || null, country: req.body.country || null, version: req.body.version || null, effective_date: req.body.effective_date || null, content: req.body.content || '', source_url: req.body.source_url || null, external_ref: req.body.external_ref || null, status: 'active' }); return res.status(201).json({ success: true, data }); });
  router.put('/knowledge/:externalRef', authorize('branch.knowledge.write'), async (req, res) => { const data = await Knowledge.findOneAndUpdate({ workspace_id: req.branchWorkspaceId, branch_id: req.branchId, external_ref: req.params.externalRef, deleted_at: null }, { $set: { type: req.body.type || 'text', title: req.body.title || req.params.externalRef, language: req.body.language || null, country: req.body.country || null, version: req.body.version || null, effective_date: req.body.effective_date || null, content: req.body.content || '', source_url: req.body.source_url || null, status: req.body.status || 'active' }, $setOnInsert: { workspace_id: req.branchWorkspaceId, branch_id: req.branchId, scope: 'branch', external_ref: req.params.externalRef } }, { new: true, upsert: true, runValidators: true }).lean(); return res.json({ success: true, data }); });
  router.use((error, req, res, next) => { console.error('[branches:public]', error); if (res.headersSent) return next(error); return res.status(400).json({ success: false, message: 'No se pudo completar la operación.' }); });
  return router;
}
