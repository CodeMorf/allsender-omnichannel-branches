import crypto from 'crypto';

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

export class BranchApiKeyService {
  constructor({ BranchApiKey }) {
    this.BranchApiKey = BranchApiKey;
  }

  async create({ workspaceId, branchId, name, scopes = ['branch.read'], expiresAt = null, actorId = null }) {
    const secret = crypto.randomBytes(32).toString('base64url');
    const prefix = `asb_${crypto.randomBytes(5).toString('hex')}`;
    const rawKey = `${prefix}.${secret}`;
    const record = await this.BranchApiKey.create({ workspace_id: workspaceId, branch_id: branchId, name, prefix, key_hash: hash(rawKey), scopes, expires_at: expiresAt, created_by: actorId });
    return { record: record.toObject(), key: rawKey };
  }

  async authenticate(rawKey, requiredScope = null) {
    if (!rawKey || !rawKey.startsWith('asb_')) return null;
    const record = await this.BranchApiKey.findOne({ key_hash: hash(rawKey), revoked_at: null });
    if (!record || (record.expires_at && record.expires_at <= new Date())) return null;
    if (requiredScope && !record.scopes.includes(requiredScope)) return null;
    record.last_used_at = new Date();
    await record.save();
    return record;
  }

  async revoke({ workspaceId, keyId }) {
    return this.BranchApiKey.findOneAndUpdate({ _id: keyId, workspace_id: workspaceId, revoked_at: null }, { $set: { revoked_at: new Date() } }, { new: true }).lean();
  }
}
