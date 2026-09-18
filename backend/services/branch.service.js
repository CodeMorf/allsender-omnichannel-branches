const cleanCode = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
const FORBIDDEN_DEFAULT_HEADERS = new Set(['authorization', 'proxy-authorization', 'cookie', 'set-cookie', 'host', 'content-length', 'transfer-encoding', 'connection', 'x-api-key', 'api-key']);
const HEADER_NAME_RE = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

const validateBaseUrl = (value) => {
  let parsed;
  try { parsed = new URL(String(value)); } catch { throw new Error('Integration URL is invalid'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Integration URL must use HTTP or HTTPS');
  if (parsed.username || parsed.password) throw new Error('Integration URL must not contain embedded credentials');
  if (!parsed.hostname || /[{}]/.test(parsed.hostname)) throw new Error('Integration URL is invalid');
  return parsed.href;
};

const sanitizeHeaders = (headers = {}) => {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return {};
  const output = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = String(name).trim();
    if (!HEADER_NAME_RE.test(normalized)) throw new Error('Integration header name is invalid');
    if (FORBIDDEN_DEFAULT_HEADERS.has(normalized.toLowerCase())) throw new Error('Sensitive integration headers must use the encrypted authentication field');
    output[normalized] = String(value);
  }
  return output;
};

const sanitizeAuthMeta = (authMeta = {}) => {
  if (!authMeta || typeof authMeta !== 'object' || Array.isArray(authMeta)) return {};
  const output = { ...authMeta };
  if (output.header !== undefined) {
    const header = String(output.header).trim();
    if (!HEADER_NAME_RE.test(header)) throw new Error('Integration authentication header is invalid');
    output.header = header;
  }
  return output;
};

const sanitizeOperations = (operations = []) => {
  if (!Array.isArray(operations)) return [];
  return operations.map((operation) => {
    const path = String(operation?.path || '');
    if (!path || /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith('//')) throw new Error('Integration operation path must be relative');
    return { ...operation, code: cleanCode(operation.code), path };
  });
};

export class BranchService {
  constructor({ Branch, Membership, BranchAgent, Knowledge, Integration, BranchApiKey, host }) { Object.assign(this, { Branch, Membership, BranchAgent, Knowledge, Integration, BranchApiKey, host }); }
  async list(workspaceId) { return this.Branch.find({ workspace_id: workspaceId, deleted_at: null }).sort({ sort_order: 1, name: 1 }).lean(); }
  async get(workspaceId, branchId) { return this.Branch.findOne({ _id: branchId, workspace_id: workspaceId, deleted_at: null }).lean(); }
  async assertBranch(workspaceId, branchId) { const branch = await this.get(workspaceId, branchId); if (!branch) throw new Error('Branch is not available'); return branch; }

  async create(workspaceId, input, actorId = null) {
    const code = cleanCode(input.code || input.name); if (!input.name || !code) throw new Error('Branch name is required');
    if (input.is_default) await this.Branch.updateMany({ workspace_id: workspaceId, deleted_at: null }, { $set: { is_default: false } });
    return this.Branch.create({ ...input, workspace_id: workspaceId, code, created_by: actorId });
  }

  async update(workspaceId, branchId, input, actorId = null) {
    const allowed = ['name','code','description','status','is_default','response_policy','address','location','timezone','languages','default_language','aliases','phone','email','manager_user_id','coverage_mode','coverage_radius_km','coverage_polygon','channel_bindings','assignment_mode','business_hours_mode','business_hours_id','business_hours','sort_order'];
    const update = {}; for (const key of allowed) if (input[key] !== undefined) update[key] = key === 'code' ? cleanCode(input[key]) : input[key]; update.updated_by = actorId;
    if (update.is_default) await this.Branch.updateMany({ workspace_id: workspaceId, _id: { $ne: branchId }, deleted_at: null }, { $set: { is_default: false } });
    return this.Branch.findOneAndUpdate({ _id: branchId, workspace_id: workspaceId, deleted_at: null }, { $set: update }, { new: true, runValidators: true }).lean();
  }

  async archive(workspaceId, branchId) { return this.Branch.findOneAndUpdate({ _id: branchId, workspace_id: workspaceId, deleted_at: null }, { $set: { deleted_at: new Date(), status: 'inactive', is_default: false } }, { new: true }).lean(); }
  async listMembers(workspaceId, branchId) { return this.Membership.find({ workspace_id: workspaceId, branch_id: branchId, deleted_at: null }).sort({ role: 1, created_at: 1 }).lean(); }
  async upsertMember(workspaceId, branchId, input) { await this.assertBranch(workspaceId, branchId); return this.Membership.findOneAndUpdate({ workspace_id: workspaceId, branch_id: branchId, user_id: input.user_id, deleted_at: null }, { $set: { role: input.role || 'agent', languages: input.languages || [], max_conversations: input.max_conversations || null, availability: input.availability || 'available', status: input.status || 'active' }, $setOnInsert: { workspace_id: workspaceId, branch_id: branchId, user_id: input.user_id } }, { upsert: true, new: true, runValidators: true }).lean(); }
  async removeMember(workspaceId, branchId, userId) { return this.Membership.findOneAndUpdate({ workspace_id: workspaceId, branch_id: branchId, user_id: userId, deleted_at: null }, { $set: { deleted_at: new Date(), status: 'inactive' } }, { new: true }).lean(); }
  async listAgents(workspaceId, branchId) { return this.BranchAgent.find({ workspace_id: workspaceId, branch_id: branchId, deleted_at: null }).sort({ priority: 1, created_at: 1 }).lean(); }
  async createAgent(workspaceId, branchId, input) { await this.assertBranch(workspaceId, branchId); return this.BranchAgent.create({ ...input, workspace_id: workspaceId, branch_id: branchId }); }
  async updateAgent(workspaceId, branchId, agentId, input) {
    const allowed = ['name','status','priority','mode','languages','instructions','ai_model_id','allowed_tools','max_steps','handoff_enabled','handoff_message']; const update = {};
    for (const key of allowed) if (input[key] !== undefined) update[key] = input[key];
    return this.BranchAgent.findOneAndUpdate({ _id: agentId, workspace_id: workspaceId, branch_id: branchId, deleted_at: null }, { $set: update }, { new: true, runValidators: true }).lean();
  }
  async archiveAgent(workspaceId, branchId, agentId) { return this.BranchAgent.findOneAndUpdate({ _id: agentId, workspace_id: workspaceId, branch_id: branchId, deleted_at: null }, { $set: { deleted_at: new Date(), status: 'inactive' } }, { new: true }).lean(); }
  async listKnowledge(workspaceId, branchId) { return this.Knowledge.find({ workspace_id: workspaceId, deleted_at: null, $or: [{ scope: 'workspace' }, { branch_id: branchId }] }).sort({ scope: 1, title: 1 }).lean(); }
  async createKnowledge(workspaceId, branchId, input) { await this.assertBranch(workspaceId, branchId); const scope = input.scope === 'workspace' ? 'workspace' : 'branch'; return this.Knowledge.create({ ...input, workspace_id: workspaceId, branch_id: scope === 'workspace' ? null : branchId, scope }); }
  async listIntegrations(workspaceId, branchId) { return this.Integration.find({ workspace_id: workspaceId, branch_id: branchId, deleted_at: null }).select('-encrypted_secret').sort({ name: 1 }).lean(); }

  async createIntegration(workspaceId, branchId, input) {
    await this.assertBranch(workspaceId, branchId);
    const data = {
      ...input,
      workspace_id: workspaceId,
      branch_id: branchId,
      code: cleanCode(input.code || input.name),
      base_url: validateBaseUrl(input.base_url),
      default_headers: sanitizeHeaders(input.default_headers),
      auth_meta: sanitizeAuthMeta(input.auth_meta),
      operations: sanitizeOperations(input.operations)
    };
    delete data.secret; delete data.encrypted_secret;
    if (!data.code) throw new Error('Integration code is required');
    if (data.auth_type !== 'none' && data.auth_type !== 'oauth' && input.secret) data.encrypted_secret = await this.host.encodeIntegrationSecret(input.secret);
    if (data.auth_type !== 'none' && data.auth_type !== 'oauth' && !data.encrypted_secret) throw new Error('Integration credentials are required');
    const created = await this.Integration.create(data);
    const output = created.toObject(); delete output.encrypted_secret;
    return output;
  }

  async updateIntegration(workspaceId, branchId, integrationId, input) {
    const existing = await this.Integration.findOne({ _id: integrationId, workspace_id: workspaceId, branch_id: branchId, deleted_at: null });
    if (!existing) return null;
    const allowed = ['name','code','base_url','auth_type','auth_meta','default_headers','operations','timeout_ms','status']; const update = {};
    for (const key of allowed) if (input[key] !== undefined) update[key] = input[key];
    if (update.code !== undefined) update.code = cleanCode(update.code);
    if (update.base_url !== undefined) update.base_url = validateBaseUrl(update.base_url);
    if (update.default_headers !== undefined) update.default_headers = sanitizeHeaders(update.default_headers);
    if (update.auth_meta !== undefined) update.auth_meta = sanitizeAuthMeta(update.auth_meta);
    if (update.operations !== undefined) update.operations = sanitizeOperations(update.operations);

    const nextAuthType = update.auth_type || existing.auth_type;
    const unset = {};
    if (nextAuthType === 'none' || nextAuthType === 'oauth') {
      unset.encrypted_secret = 1;
    } else if (input.secret) {
      update.encrypted_secret = await this.host.encodeIntegrationSecret(input.secret);
    } else if (!existing.encrypted_secret) {
      throw new Error('Integration credentials are required');
    }

    const mutation = { $set: update };
    if (Object.keys(unset).length) mutation.$unset = unset;
    return this.Integration.findOneAndUpdate({ _id: integrationId, workspace_id: workspaceId, branch_id: branchId, deleted_at: null }, mutation, { new: true, runValidators: true }).select('-encrypted_secret').lean();
  }

  async archiveIntegration(workspaceId, branchId, integrationId) { return this.Integration.findOneAndUpdate({ _id: integrationId, workspace_id: workspaceId, branch_id: branchId, deleted_at: null }, { $set: { deleted_at: new Date(), status: 'inactive' } }, { new: true }).select('-encrypted_secret').lean(); }
  async listApiKeys(workspaceId, branchId) { return this.BranchApiKey.find({ workspace_id: workspaceId, branch_id: branchId }).select('-key_hash').sort({ created_at: -1 }).lean(); }
}
