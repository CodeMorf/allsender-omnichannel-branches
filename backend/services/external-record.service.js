const TYPES = new Set(['order', 'tracking', 'customer', 'inventory', 'reservation', 'custom']);

export class BranchExternalRecordService {
  constructor({ ExternalRecord }) {
    this.ExternalRecord = ExternalRecord;
  }

  normalizeType(type) {
    const normalized = String(type || '').trim().toLowerCase();
    if (!TYPES.has(normalized)) throw new Error('External record type is not supported');
    return normalized;
  }

  async get({ workspaceId, branchId, type, externalId }) {
    return this.ExternalRecord.findOne({
      workspace_id: workspaceId,
      branch_id: branchId,
      type: this.normalizeType(type),
      external_id: String(externalId),
      deleted_at: null
    }).lean();
  }

  async list({ workspaceId, branchId, type, limit = 50 }) {
    return this.ExternalRecord.find({
      workspace_id: workspaceId,
      branch_id: branchId,
      type: this.normalizeType(type),
      deleted_at: null
    }).sort({ updated_at: -1 }).limit(Math.min(Math.max(Number(limit) || 50, 1), 100)).lean();
  }

  async upsert({ workspaceId, branchId, type, externalId, payload, externalUpdatedAt = null, source = 'branch_api' }) {
    return this.ExternalRecord.findOneAndUpdate(
      {
        workspace_id: workspaceId,
        branch_id: branchId,
        type: this.normalizeType(type),
        external_id: String(externalId),
        deleted_at: null
      },
      {
        $set: {
          payload: payload && typeof payload === 'object' ? payload : { value: payload },
          external_updated_at: externalUpdatedAt ? new Date(externalUpdatedAt) : null,
          source
        },
        $setOnInsert: { workspace_id: workspaceId, branch_id: branchId, type: this.normalizeType(type), external_id: String(externalId) }
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();
  }
}

export default BranchExternalRecordService;
