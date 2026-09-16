const TYPES = new Set(['order', 'tracking', 'customer', 'inventory', 'reservation', 'custom']);
const norm = (value) => String(value || '').trim().toLowerCase();
const normPhone = (value) => String(value || '').replace(/[^0-9+]/g, '');

export class BranchExternalRecordService {
  constructor({ ExternalRecord }) { this.ExternalRecord = ExternalRecord; }

  normalizeType(type) {
    const normalized = norm(type);
    if (!TYPES.has(normalized)) throw new Error('External record type is not supported');
    return normalized;
  }

  async get({ workspaceId, branchId, type, externalId }) {
    return this.ExternalRecord.findOne({ workspace_id: workspaceId, branch_id: branchId, type: this.normalizeType(type), external_id: String(externalId), deleted_at: null }).lean();
  }

  async getForCustomer({ workspaceId, branchId, type, externalId, customer = {} }) {
    const record = await this.get({ workspaceId, branchId, type, externalId });
    if (!record) return null;
    if (record.access_mode === 'public') return record;
    const refs = record.customer_refs || {};
    const contactMatches = refs.contact_id && customer.contact_id && String(refs.contact_id) === String(customer.contact_id);
    const phoneMatches = refs.phone && customer.phone && normPhone(refs.phone) === normPhone(customer.phone);
    const emailMatches = refs.email && customer.email && norm(refs.email) === norm(customer.email);
    return contactMatches || phoneMatches || emailMatches ? record : null;
  }

  async list({ workspaceId, branchId, type, limit = 50 }) {
    return this.ExternalRecord.find({ workspace_id: workspaceId, branch_id: branchId, type: this.normalizeType(type), deleted_at: null }).sort({ updated_at: -1 }).limit(Math.min(Math.max(Number(limit) || 50, 1), 100)).lean();
  }

  async upsert({ workspaceId, branchId, type, externalId, payload, externalUpdatedAt = null, source = 'branch_api', customerRefs = {}, accessMode = 'customer_bound' }) {
    return this.ExternalRecord.findOneAndUpdate(
      { workspace_id: workspaceId, branch_id: branchId, type: this.normalizeType(type), external_id: String(externalId), deleted_at: null },
      {
        $set: {
          payload: payload && typeof payload === 'object' ? payload : { value: payload },
          external_updated_at: externalUpdatedAt ? new Date(externalUpdatedAt) : null,
          source,
          access_mode: accessMode === 'public' ? 'public' : 'customer_bound',
          customer_refs: {
            contact_id: customerRefs.contact_id ? String(customerRefs.contact_id) : null,
            phone: customerRefs.phone ? String(customerRefs.phone) : null,
            email: customerRefs.email ? String(customerRefs.email).toLowerCase() : null
          }
        },
        $setOnInsert: { workspace_id: workspaceId, branch_id: branchId, type: this.normalizeType(type), external_id: String(externalId) }
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();
  }
}

export default BranchExternalRecordService;
