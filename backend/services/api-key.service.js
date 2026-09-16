import crypto from 'crypto';

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const ALLOWED_SCOPES = new Set([
  'branch.read',
  'branch.orders.read', 'branch.orders.write',
  'branch.tracking.read', 'branch.tracking.write',
  'branch.data.read', 'branch.data.write',
  'branch.knowledge.read', 'branch.knowledge.write'
]);
const normalizeIp = (value) => String(value || '').trim().replace(/^::ffff:/i, '');

export class BranchApiKeyService {
  constructor({ BranchApiKey }) {
    this.BranchApiKey = BranchApiKey;
    this.rateBuckets = new Map();
  }

  normalizeScopes(scopes) {
    const values = Array.isArray(scopes) && scopes.length ? scopes : ['branch.read'];
    const normalized = [...new Set(values.map((item) => String(item).trim().toLowerCase()))];
    if (normalized.some((scope) => !ALLOWED_SCOPES.has(scope))) throw new Error('Branch API scope is not supported');
    return normalized;
  }

  checkRateLimit(record) {
    const limit = Math.min(Math.max(Number(record.rate_limit_per_minute) || 120, 1), 10000);
    const minute = Math.floor(Date.now() / 60000);
    const key = `${record.key_hash}:${minute}`;
    const count = (this.rateBuckets.get(key) || 0) + 1;
    this.rateBuckets.set(key, count);
    if (this.rateBuckets.size > 5000) {
      for (const bucketKey of this.rateBuckets.keys()) {
        const bucketMinute = Number(bucketKey.split(':').pop());
        if (Number.isFinite(bucketMinute) && bucketMinute < minute - 1) this.rateBuckets.delete(bucketKey);
      }
    }
    return count <= limit;
  }

  async create({ workspaceId, branchId, name, scopes = ['branch.read'], expiresAt = null, actorId = null, ipAllowlist = [], rateLimitPerMinute = 120 }) {
    const secret = crypto.randomBytes(32).toString('base64url');
    const prefix = `asb_${crypto.randomBytes(5).toString('hex')}`;
    const rawKey = `${prefix}.${secret}`;
    const normalizedIps = [...new Set((Array.isArray(ipAllowlist) ? ipAllowlist : []).map(normalizeIp).filter(Boolean))];
    const rateLimit = Math.min(Math.max(Number(rateLimitPerMinute) || 120, 1), 10000);
    const record = await this.BranchApiKey.create({ workspace_id: workspaceId, branch_id: branchId, name, prefix, key_hash: hash(rawKey), scopes: this.normalizeScopes(scopes), expires_at: expiresAt, created_by: actorId, ip_allowlist: normalizedIps, rate_limit_per_minute: rateLimit });
    return { record: record.toObject(), key: rawKey };
  }

  async authenticate(rawKey, requiredScope = null, requestIp = null) {
    if (!rawKey || !rawKey.startsWith('asb_')) return null;
    const record = await this.BranchApiKey.findOne({ key_hash: hash(rawKey), revoked_at: null });
    if (!record || (record.expires_at && record.expires_at <= new Date())) return null;
    if (requiredScope && !record.scopes.includes(requiredScope)) return null;
    const normalizedIp = normalizeIp(requestIp);
    if (record.ip_allowlist?.length && (!normalizedIp || !record.ip_allowlist.map(normalizeIp).includes(normalizedIp))) return null;
    if (!this.checkRateLimit(record)) return null;
    record.last_used_at = new Date();
    record.last_used_ip = normalizedIp || null;
    await record.save();
    return record;
  }

  async revoke({ workspaceId, keyId }) {
    return this.BranchApiKey.findOneAndUpdate({ _id: keyId, workspace_id: workspaceId, revoked_at: null }, { $set: { revoked_at: new Date() } }, { new: true }).lean();
  }
}
