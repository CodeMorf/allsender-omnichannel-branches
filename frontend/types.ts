export type BranchStatus = 'active' | 'inactive';
export type AssignmentMode = 'manual' | 'first_claim' | 'round_robin' | 'least_load';
export type CoverageMode = 'none' | 'radius' | 'polygon';
export type AgentMode = 'autonomous' | 'copilot';
export type ResponsePolicy = 'legacy_first' | 'ai_first' | 'ai_only' | 'human_only' | 'legacy_only';

export interface Branch {
  _id: string;
  name: string;
  code: string;
  description?: string;
  status: BranchStatus;
  is_default?: boolean;
  response_policy?: ResponsePolicy;
  address?: { country?: string; region?: string; city?: string; postal_code?: string; address_line?: string };
  location?: { type: 'Point'; coordinates: [number, number] };
  timezone?: string;
  languages?: string[];
  default_language?: string | null;
  aliases?: string[];
  phone?: string | null;
  email?: string | null;
  coverage_mode?: CoverageMode;
  coverage_radius_km?: number | null;
  coverage_polygon?: unknown;
  assignment_mode?: AssignmentMode;
  channel_bindings?: Array<{ channel_type: string; connection_id: string }>;
}

export interface BranchMember { _id: string; branch_id: string; user_id: string; role: 'agent'|'supervisor'|'manager'; languages: string[]; max_conversations?: number|null; availability: 'available'|'busy'|'away'|'offline'; status: BranchStatus; }
export interface BranchAgent { _id: string; branch_id: string; name: string; status: BranchStatus; priority: number; mode: AgentMode; languages: string[]; instructions: string; ai_model_id?: string|null; allowed_tools: string[]; max_steps: number; handoff_enabled: boolean; handoff_message?: string; }
export interface BranchKnowledge { _id: string; scope: 'workspace'|'branch'; type: string; title: string; language?: string|null; content?: string; source_url?: string|null; status: BranchStatus; }
export interface BranchIntegration { _id: string; name: string; code: string; base_url: string; auth_type: 'none'|'api_key'|'bearer'|'basic'|'oauth'; operations: Array<{ code: string; name: string; method: string; path: string; enabled: boolean; read_only: boolean }>; status: BranchStatus; }
export interface BranchHandoff { _id: string; branch_id: string; conversation_key: string; language?: string|null; reason: string; priority: string; summary: string; status: 'waiting'|'claimed'|'cancelled'|'closed'; claimed_by?: string|null; }
export interface BranchApiKeyInfo { _id: string; branch_id: string; name: string; prefix: string; scopes: string[]; ip_allowlist: string[]; rate_limit_per_minute: number; expires_at?: string|null; last_used_at?: string|null; last_used_ip?: string|null; revoked_at?: string|null; created_at?: string; }
export interface BranchResolveInput { conversationKey?: string; channelType?: string; connectionId?: string; location?: { latitude: number; longitude: number }; text?: string; force?: boolean; }
export interface ApiResponse<T> { success: boolean; data: T; message?: string; }
