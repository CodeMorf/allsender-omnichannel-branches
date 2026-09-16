import express from 'express';

const extractKey = (req) => {
  const header = req.headers?.authorization;
  if (typeof header === 'string' && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim();
  const direct = req.headers?.['x-branch-api-key'];
  return typeof direct === 'string' ? direct.trim() : null;
};

const readScopeFor = (type) => type === 'order' ? 'branch.orders.read' : type === 'tracking' ? 'branch.tracking.read' : 'branch.data.read';
const writeScopeFor = (type) => type === 'order' ? 'branch.orders.write' : type === 'tracking' ? 'branch.tracking.write' : 'branch.data.write';

export function createBranchPublicRouter({ apiKeyService, externalRecordService, Branch, Knowledge }) {
  const router = express.Router();

  const authorize = (scopeResolver) => async (req, res, next) => {
    try {
      const scope = typeof scopeResolver === 'function' ? scopeResolver(req) : scopeResolver;
      const key = await apiKeyService.authenticate(extractKey(req), scope);
      if (!key) return res.status(401).json({ success: false, message: 'API key inválida, vencida o sin permisos.' });
      req.branchApiKey = key;
      req.branchWorkspaceId = key.workspace_id;
      req.branchId = key.branch_id;
      return next();
    } catch (error) {
      console.error('[branches:public-auth]', error);
      return res.status(401).json({ success: false, message: 'No se pudo validar la credencial.' });
    }
  };

  router.get('/profile', authorize('branch.read'), async (req, res) => {
    const branch = await Branch.findOne({ _id: req.branchId, workspace_id: req.branchWorkspaceId, deleted_at: null, status: 'active' })
      .select('name code description address location timezone languages default_language phone email coverage_mode status')
      .lean();
    if (!branch) return res.status(404).json({ success: false, message: 'Sucursal no disponible.' });
    return res.json({ success: true, data: branch });
  });

  router.get('/records/:type', authorize((req) => readScopeFor(req.params.type)), async (req, res) => {
    const data = await externalRecordService.list({ workspaceId: req.branchWorkspaceId, branchId: req.branchId, type: req.params.type, limit: req.query.limit });
    return res.json({ success: true, data });
  });

  router.get('/records/:type/:externalId', authorize((req) => readScopeFor(req.params.type)), async (req, res) => {
    const data = await externalRecordService.get({ workspaceId: req.branchWorkspaceId, branchId: req.branchId, type: req.params.type, externalId: req.params.externalId });
    if (!data) return res.status(404).json({ success: false, message: 'Registro no encontrado.' });
    return res.json({ success: true, data });
  });

  router.put('/records/:type/:externalId', authorize((req) => writeScopeFor(req.params.type)), async (req, res) => {
    const data = await externalRecordService.upsert({ workspaceId: req.branchWorkspaceId, branchId: req.branchId, type: req.params.type, externalId: req.params.externalId, payload: req.body?.payload ?? req.body, externalUpdatedAt: req.body?.external_updated_at, source: 'branch_api' });
    return res.json({ success: true, data });
  });

  router.get('/knowledge', authorize('branch.knowledge.read'), async (req, res) => {
    const data = await Knowledge.find({ workspace_id: req.branchWorkspaceId, deleted_at: null, status: 'active', $or: [{ scope: 'workspace' }, { branch_id: req.branchId }] })
      .select('scope type title language country version effective_date content source_url updated_at')
      .sort({ scope: 1, title: 1 }).lean();
    return res.json({ success: true, data });
  });

  router.use((error, req, res, next) => {
    console.error('[branches:public]', error);
    if (res.headersSent) return next(error);
    return res.status(400).json({ success: false, message: 'No se pudo completar la operación.' });
  });

  return router;
}
