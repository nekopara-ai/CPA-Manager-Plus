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
  | 'meta'
  | 'empty'
  | 'unknown';

export type CodexTurnTicketState =
  | 'healthy'
  | 'direct'
  | 'blocked'
  | 'partial'
  | 'expiring'
  | 'expired_or_invalid'
  | 'missing'
  | 'unclassified'
  | 'disabled'
  | 'not_scoped'
  | 'unavailable';

export type CodexTurnTicketRoutingMode = 'unknown' | 'direct' | 'inject' | 'blocked';

export interface CodexTurnTicketModelSnapshot {
  model?: string;
  ticket_state?: string;
  ticketState?: string;
  routing_mode?: string;
  routingMode?: string;
  routing_cookie_names?: string[];
  routingCookieNames?: string[];
  routing_validated_at?: string | number;
  routingValidatedAt?: string | number;
  routing_expires_at?: string | number;
  routingExpiresAt?: string | number;
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
  probe_in_flight?: boolean;
  probeInFlight?: boolean;
  probe_phase?: string;
  probePhase?: string;
  probe_attempts?: number;
  probeAttempts?: number;
  last_probe_at?: string | number;
  lastProbeAt?: string | number;
  last_probe_phase?: string;
  lastProbePhase?: string;
  last_probe_result?: string;
  lastProbeResult?: string;
  last_probe_complete?: boolean;
  lastProbeComplete?: boolean;
  last_probe_model_match?: boolean;
  lastProbeModelMatch?: boolean;
  next_probe_at?: string | number;
  nextProbeAt?: string | number;
  probe_backoff_until?: string | number;
  probeBackoffUntil?: string | number;
  harvest_backoff_until?: string | number;
  harvestBackoffUntil?: string | number;
}

export interface CodexTurnTicketCredentialSnapshot {
  plan?: string;
  plan_source?: string;
  configured?: boolean;
  enabled?: boolean;
  injection_enabled?: boolean;
  injectionEnabled?: boolean;
  adaptive_injection?: boolean;
  adaptiveInjection?: boolean;
  harvester_active?: boolean;
  harvesterActive?: boolean;
  target_length?: number;
  targetLength?: number;
  degraded_length?: number;
  degradedLength?: number;
  block_on_degraded?: boolean;
  blockOnDegraded?: boolean;
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
