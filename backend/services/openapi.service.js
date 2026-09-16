const ALLOWED_METHODS = ['get', 'post', 'put', 'patch', 'delete'];

const normalizeBaseUrl = (document) => {
  const server = Array.isArray(document?.servers) ? document.servers.find((item) => item?.url) : null;
  return server?.url || '';
};

export class OpenApiImportService {
  parse(document) {
    if (!document || typeof document !== 'object' || !document.paths || typeof document.paths !== 'object') {
      throw new Error('OpenAPI document is invalid');
    }

    const operations = [];
    for (const [path, definition] of Object.entries(document.paths)) {
      for (const method of ALLOWED_METHODS) {
        const operation = definition?.[method];
        if (!operation) continue;
        const rawCode = operation.operationId || `${method}_${path}`;
        const code = String(rawCode).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
        operations.push({
          code,
          name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
          method: method.toUpperCase(),
          path,
          enabled: method === 'get',
          read_only: method === 'get'
        });
      }
    }

    return {
      title: document.info?.title || 'Imported API',
      description: document.info?.description || '',
      version: document.info?.version || null,
      base_url: normalizeBaseUrl(document),
      operations
    };
  }
}

export default new OpenApiImportService();
