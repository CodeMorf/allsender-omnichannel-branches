import type { ApiResponse, Branch, BranchAgent, BranchHandoff, BranchIntegration, BranchKnowledge, BranchMember, BranchResolveInput } from './types';

export interface BranchesApiOptions { baseUrl?: string; workspaceId: () => string | null; fetcher?: typeof fetch; getAuthHeaders?: () => Record<string,string>; }

export function createBranchesApi(options: BranchesApiOptions) {
  const baseUrl = (options.baseUrl || '/api/branches').replace(/\/$/, '');
  const fetcher = options.fetcher || fetch;
  const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const workspaceId = options.workspaceId();
    if (!workspaceId) throw new Error('Selecciona un espacio de trabajo.');
    const response = await fetcher(`${baseUrl}${path}`, { credentials: 'include', ...init, headers: { 'Content-Type': 'application/json', 'x-workspace-id': workspaceId, ...(options.getAuthHeaders?.() || {}), ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({ success: false, message: 'No se pudo procesar la respuesta.' }));
    if (!response.ok || payload.success === false) throw new Error(payload.message || 'No se pudo completar la operación.');
    return payload.data as T;
  };
  return {
    list: () => request<Branch[]>(''),
    get: (id: string) => request<Branch>(`/${id}`),
    create: (input: Partial<Branch>) => request<Branch>('', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: Partial<Branch>) => request<Branch>(`/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    archive: (id: string) => request<Branch>(`/${id}`, { method: 'DELETE' }),
    resolve: (input: BranchResolveInput) => request<unknown>('/resolve', { method: 'POST', body: JSON.stringify(input) }),
    members: (id: string) => request<BranchMember[]>(`/${id}/members`),
    saveMember: (id: string, input: Partial<BranchMember> & { user_id: string }) => request<BranchMember>(`/${id}/members`, { method: 'POST', body: JSON.stringify(input) }),
    removeMember: (id: string, userId: string) => request<BranchMember>(`/${id}/members/${userId}`, { method: 'DELETE' }),
    agents: (id: string) => request<BranchAgent[]>(`/${id}/agents`),
    createAgent: (id: string, input: Partial<BranchAgent>) => request<BranchAgent>(`/${id}/agents`, { method: 'POST', body: JSON.stringify(input) }),
    updateAgent: (id: string, agentId: string, input: Partial<BranchAgent>) => request<BranchAgent>(`/${id}/agents/${agentId}`, { method: 'PATCH', body: JSON.stringify(input) }),
    knowledge: (id: string) => request<BranchKnowledge[]>(`/${id}/knowledge`),
    createKnowledge: (id: string, input: Partial<BranchKnowledge>) => request<BranchKnowledge>(`/${id}/knowledge`, { method: 'POST', body: JSON.stringify(input) }),
    integrations: (id: string) => request<BranchIntegration[]>(`/${id}/integrations`),
    createIntegration: (id: string, input: Partial<BranchIntegration> & { secret?: string }) => request<BranchIntegration>(`/${id}/integrations`, { method: 'POST', body: JSON.stringify(input) }),
    updateIntegration: (id: string, integrationId: string, input: Partial<BranchIntegration> & { secret?: string }) => request<BranchIntegration>(`/${id}/integrations/${integrationId}`, { method: 'PATCH', body: JSON.stringify(input) }),
    importOpenApi: (id: string, input: unknown) => request<BranchIntegration>(`/${id}/integrations/import-openapi`, { method: 'POST', body: JSON.stringify(input) }),
    handoffs: (id: string, language?: string) => request<BranchHandoff[]>(`/${id}/handoffs${language ? `?language=${encodeURIComponent(language)}` : ''}`),
    claim: (handoffId: string) => request<unknown>(`/handoffs/${handoffId}/claim`, { method: 'POST', body: '{}' }),
    apiKeys: (id: string) => request<Array<Record<string,unknown>>>(`/${id}/api-keys`),
    createApiKey: (id: string, input: { name?: string; scopes: string[]; expires_at?: string|null }) => request<Record<string,unknown>>(`/${id}/api-keys`, { method: 'POST', body: JSON.stringify(input) })
  };
}

export * from './types';
