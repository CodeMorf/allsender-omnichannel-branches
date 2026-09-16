const cleanCode = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');

export class BranchService {
  constructor({ Branch, Membership, BranchAgent, Knowledge, Integration, BranchApiKey, host }) { Object.assign(this, { Branch, Membership, BranchAgent, Knowledge, Integration, BranchApiKey, host }); }
  async list(workspaceId) { return this.Branch.find({ workspace_id: workspaceId, deleted_at: null }).sort({ sort_order: 1, name: 1 }).lean(); }
  async get(workspaceId, branchId) { return this.Branch.findOne({ _id: branchId, workspace_id: workspaceId, deleted_at: null }).lean(); }
  async create(workspaceId, input, actorId = null) {
    const code = cleanCode(input.code || input.name); if (!input.name || !code) throw new Error('Branch name is required');
    if (input.is_default) await this.Branch.updateMany({ workspace_id: workspaceId, deleted_at: null }, { $set: { is_default: false } });
    return this.Branch.create({ ...input, workspace_id: workspaceId, code, created_by: actorId });
  }
  async update(workspaceId, branchId, input, actorId = null) {
    const allowed = ['name','code','description','status','is_default','response_policy','address','location','timezone','languages','default_language','aliases','phone','email','manager_user_id','coverage_mode','coverage_radius_km','coverage_polygon','channel_bindings','assignment_mode','business_hours_mode','business_hours_id','sort_order'];
    const update = {}; for (const key of allowed) if (input[key] !== undefined) update[key] = key === 'code' ? cleanCode(input[key]) : input[key]; update.updated_by = actorId;
    if (update.is_default) await this.Branch.updateMany({ workspace_id: workspaceId, _id: { $ne: branchId }, deleted_at: null }, { $set: { is_default: false } });
    return this.Branch.findOneAndUpdate({ _id: branchId, workspace_id: workspaceId, deleted_at: null }, { $set: update }, { new: true, runValidators: true }).lean();
  }
  async archive(workspaceId, branchId) { return this.Branch.findOneAndUpdate({ _id: branchId, workspace_id: workspaceId, deleted_at: null }, { $set: { deleted_at: new Date(), status: 'inactive', is_default: false } }, { new: true }).lean(); }
  async listMembers(workspaceId, branchId) { return this.Membership.find({ workspace_id: workspaceId, branch_id: branchId, deleted_at: null }).sort({ role: 1, created_at: 1 }).lean(); }
  async upsertMember(workspaceId, branchId, input) { return this.Membership.findOneAndUpdate({ workspace_id: workspaceId, branch_id: branchId, user_id: input.user_id, deleted_at: null }, { $set: { role: input.role || 'agent', languages: input.languages || [], max_conversations: input.max_conversations || null, availability: input.availability || 'available', status: input.status || 'active' }, $setOnInsert: { workspace_id: workspaceId, branch_id: branchId, user_id: input.user_id } }, { upsert: true, new: true, runValidators: true }).lean(); }
  async removeMember(workspaceId, branchId, userId) { return this.Membership.findOneAndUpdate({ workspace_id: workspaceId, branch_id: branchId, user_id: userId, deleted_at: null }, { $set: { deleted_at: new Date(), status: 'inactive' } }, { new: true }).lean(); }
  async listAgents(workspaceId, branchId) { return this.BranchAgent.find({ workspace_id: workspaceId, branch_id: branchId, deleted_at: null }).sort({ priority: 1, created_at: 1 }).lean(); }
  async createAgent(workspaceId, branchId, input) { return this.BranchAgent.create({ ...input, workspace_id: workspaceId, branch_id: branchId }); }
  async updateAgent(workspaceId, branchId, agentId, input) {
    const allowed = ['name','status','priority','mode','languages','instructions','ai_model_id','allowed_tools','max_steps','handoff_enabled','handoff_message']; const update = {};
    for (const key of allowed) if (input[key] !== undefined) update[key] = input[key];
    return this.BranchAgent.findOneAndUpdate({ _id: agentId, workspace_id: workspaceId, branch_id: branchId, deleted_at: null }, { $set: update }, { new: true, runValidators: true }).lean();
  }
  async archiveAgent(workspaceId, branchId, agentId) { return this.BranchAgent.findOneAndUpdate({ _id: agentId, workspace_id: workspaceId, branch_id: branchId, deleted_at: null }, { $set: { deleted_at: new Date(), status: 'inactive' } }, { new: true }).lean(); }
  async listKnowledge(workspaceId, branchId) { return this.Knowledge.find({ workspace_id: workspaceId, deleted_at: null, $or: [{ scope: 'workspace' }, { branch_id: branchId }] }).sort({ scope: 1, title: 1 }).lean(); }
  async createKnowledge(workspaceId, branchId, input) { const scope = input.scope === 'workspace' ? 'workspace' : 'branch'; return this.Knowledge.create({ ...input, workspace_id: workspaceId, branch_id: scope === 'workspace' ? null : branchId, scope }); }
  async listIntegrations(workspaceId, branchId) { return this.Integration.find({ workspace_id: workspaceId, branch_id: branchId, deleted_at: null }).select('-encrypted_secret').sort({ name: 1 }).lean(); }
  async createIntegration(workspaceId, branchId, input) {
    const data = { ...input, workspace_id: workspaceId, branch_id: branchId }; delete data.secret; delete data.encrypted_secret;
    if (input.secret) data.encrypted_secret = await this.host.encodeIntegrationSecret(input.secret);
    if (data.auth_type !== 'none' && !data.encrypted_secret) throw new Error('Integration credentials are required');
    return this.Integration.create(data);
  }
  async updateIntegration(workspaceId, branchId, integrationId, input) {
    const allowed = ['name','code','base_url','auth_type','auth_meta','default_headers','operations','timeout_ms','status']; const update = {};
    for (const key of allowed) if (input[key] !== undefined) update[key] = input[key];
    if (input.secret) update.encrypted_secret = await this.host.encodeIntegrationSecret(input.secret);
    return this.Integration.findOneAndUpdate({ _id: integrationId, workspace_id: workspaceId, branch_id: branchId, deleted_at: null }, { $set: update }, { new: true, runValidators: true }).select('-encrypted_secret').lean();
  }
  async archiveIntegration(workspaceId, branchId, integrationId) { return this.Integration.findOneAndUpdate({ _id: integrationId, workspace_id: workspaceId, branch_id: branchId, deleted_at: null }, { $set: { deleted_at: new Date(), status: 'inactive' } }, { new: true }).select('-encrypted_secret').lean(); }
  async listApiKeys(workspaceId, branchId) { return this.BranchApiKey.find({ workspace_id: workspaceId, branch_id: branchId }).select('-key_hash').sort({ created_at: -1 }).lean(); }
}
