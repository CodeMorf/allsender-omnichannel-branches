const interpolatePath = (path, params) => path.replace(/\{([^}]+)\}/g, (_, key) => {
  if (params?.[key] === undefined) throw new Error(`Missing integration parameter: ${key}`);
  return encodeURIComponent(String(params[key]));
});

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

    const path = interpolatePath(operation.path, params);
    const url = new URL(path, integration.base_url.endsWith('/') ? integration.base_url : `${integration.base_url}/`);
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
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({ ok: response.ok, status: response.status }));
      if (!response.ok) throw new Error(data?.message || `Integration request failed (${response.status})`);
      return { success: true, data };
    } finally {
      clearTimeout(timer);
    }
  }
}
