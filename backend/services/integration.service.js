import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

const interpolatePath = (path, params) => path.replace(/\{([^}]+)\}/g, (_, key) => {
  if (params?.[key] === undefined) throw new Error(`Missing integration parameter: ${key}`);
  return encodeURIComponent(String(params[key]));
});

const isPrivateIpv4 = (address) => {
  const parts = String(address).split('.').map(Number);
  if (parts.length !== 4 || parts.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return true;
  const [a, b] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
};

const isPrivateIp = (address) => {
  const family = net.isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family !== 6) return true;
  const normalized = String(address).toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('::ffff:')) return isPrivateIpv4(normalized.slice(7));
  return false;
};

export const validateIntegrationUrlShape = (rawUrl) => {
  let url;
  try {
    url = rawUrl instanceof URL ? new URL(rawUrl.href) : new URL(String(rawUrl));
  } catch {
    throw new Error('Integration URL is invalid');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Integration URL must use HTTP or HTTPS');
  if (url.username || url.password) throw new Error('Integration URL must not contain embedded credentials');
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new Error('Integration URL points to a private host');
  }
  return url;
};

export const assertSafeIntegrationUrl = async (rawUrl) => {
  const url = validateIntegrationUrlShape(rawUrl);
  const hostname = url.hostname;
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error('Integration URL points to a private network');
    return url;
  }
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) {
    throw new Error('Integration URL resolves to a private network');
  }
  return url;
};

const readResponseBody = async (response) => {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) throw new Error('Integration response is too large');
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => null);
      throw new Error('Integration response is too large');
    }
    chunks.push(Buffer.from(value));
  }
  if (!chunks.length) return null;
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

export class BranchIntegrationService {
  constructor({ Integration, host }) {
    this.Integration = Integration;
    this.host = host;
  }

  async execute({ workspaceId, branchId, integrationCode, operationCode, params = {}, allowWrite = false }) {
    const integration = await this.Integration.findOne({ workspace_id: workspaceId, branch_id: branchId, code: String(integrationCode).toLowerCase(), status: 'active', deleted_at: null }).lean();
    if (!integration) throw new Error('Integration is not available for this branch');
    const operation = (integration.operations || []).find((item) => item.enabled && item.code === String(operationCode).toLowerCase());
    if (!operation) throw new Error('Integration operation is not available');
    if (!operation.read_only && !allowWrite) throw new Error('This operation requires explicit write permission');
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(operation.path) || String(operation.path).startsWith('//')) {
      throw new Error('Integration operation path must be relative to the configured base URL');
    }

    const baseUrl = await assertSafeIntegrationUrl(integration.base_url);
    const path = interpolatePath(operation.path, params);
    const url = new URL(path, baseUrl.href.endsWith('/') ? baseUrl.href : `${baseUrl.href}/`);
    if (url.origin !== baseUrl.origin) throw new Error('Integration operation cannot change the configured API origin');
    await assertSafeIntegrationUrl(url);

    const usedKeys = new Set([...operation.path.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]));
    if (operation.method === 'GET') for (const [key, value] of Object.entries(params)) if (!usedKeys.has(key) && value != null) url.searchParams.set(key, String(value));

    const auth = await this.host.resolveIntegrationAuth?.(integration) || {};
    const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json', ...(integration.default_headers || {}), ...(auth.headers || {}) };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), integration.timeout_ms || 10000);
    try {
      const response = await fetch(url, {
        method: operation.method,
        headers,
        body: operation.method === 'GET' ? undefined : JSON.stringify(params),
        signal: controller.signal,
        redirect: 'error'
      });
      const data = await readResponseBody(response);
      if (!response.ok) throw new Error(data?.message || `Integration request failed (${response.status})`);
      return { success: true, data };
    } finally {
      clearTimeout(timer);
    }
  }
}
