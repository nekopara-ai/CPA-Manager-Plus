/**
 * 认证文件相关类型
 * 基于原项目 src/modules/auth-files.js
 */

import type { RecentRequestBucket } from '@/utils/recentRequests';

export type AuthFileType =
  | 'qwen'
  | 'kimi'
  | 'gemini'
  | 'aistudio'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'xai'
  | 'iflow'
  | 'vertex'
  | 'devin'
  | 'empty'
  | 'unknown';

export type CodexTurnTicketState =
  | 'healthy'
  | 'partial'
  | 'expiring'
  | 'expired_or_invalid'
  | 'missing'
  | 'disabled'
  | 'not_scoped'
  | 'unavailable';

export interface CodexTurnTicketModelSnapshot {
  model?: string;
  ticket_state?: string;
  ticketState?: string;
  ticket_length?: number;
  ticketLength?: number;
  expires_at?: string | number;
  expiresAt?: string | number;
  last_observed_at?: string | number;
  lastObservedAt?: string | number;
  last_http_status?: number;
  lastHttpStatus?: number;
  last_observed_length?: number;
  lastObservedLength?: number;
  last_observed_healthy?: boolean;
  lastObservedHealthy?: boolean;
  last_result?: string;
  lastResult?: string;
}

export interface CodexTurnTicketCredentialSnapshot {
  plan?: string;
  plan_source?: string;
  configured?: boolean;
  enabled?: boolean;
  harvester_active?: boolean;
  harvesterActive?: boolean;
  target_length?: number;
  targetLength?: number;
  state?: CodexTurnTicketState | string;
  healthy_models?: number;
  healthyModels?: number;
  total_models?: number;
  totalModels?: number;
  earliest_expires_at?: string | number;
  earliestExpiresAt?: string | number;
  models?: CodexTurnTicketModelSnapshot[];
}

export interface AuthFileItem {
  id?: string;
  name: string;
  type?: AuthFileType | string;
  provider?: string;
  size?: number;
  authIndex?: string | number | null;
  runtimeOnly?: boolean | string;
  disabled?: boolean;
  weight?: number;
  unavailable?: boolean;
  status?: string;
  statusMessage?: string;
  lastRefresh?: string | number;
  modified?: number;
  success?: unknown;
  failed?: unknown;
  project_id?: string;
  projectId?: string;
  gemini_virtual_project?: string;
  geminiVirtualProject?: string;
  recent_requests?: RecentRequestBucket[];
  recentRequests?: RecentRequestBucket[];
  codex_turn_ticket?: CodexTurnTicketCredentialSnapshot;
  codexTurnTicket?: CodexTurnTicketCredentialSnapshot;
  [key: string]: unknown;
}

export interface AuthFilesResponse {
  files: AuthFileItem[];
  total?: number;
}
