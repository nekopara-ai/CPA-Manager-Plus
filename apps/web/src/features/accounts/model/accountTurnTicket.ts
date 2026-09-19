import type {
  AuthFileItem,
  CodexTurnTicketCredentialSnapshot,
  CodexTurnTicketModelSnapshot,
  CodexTurnTicketState,
} from '@/types';

export const ACCOUNT_TURN_TICKET_FILTERS = [
  'all',
  'ready',
  'partial',
  'missing',
  'unknown',
] as const;

export type AccountTurnTicketFilter = (typeof ACCOUNT_TURN_TICKET_FILTERS)[number];
export type AccountTurnTicketDisplayState = CodexTurnTicketState | 'not_applicable';

export interface AccountTurnTicketModelSummary {
  model: string;
  ticketState: string;
  ticketLength: number | null;
  expiresAtMs: number | null;
  lastObservedAtMs: number | null;
  lastHttpStatus: number | null;
  lastObservedLength: number | null;
  lastObservedHealthy: boolean;
  lastResult: string;
}

export interface AccountTurnTicketSummary {
  plan?: string;
  planSource?: string;
  applicable: boolean;
  configured: boolean;
  enabled: boolean;
  harvesterActive: boolean;
  targetLength: number;
  state: AccountTurnTicketDisplayState;
  healthyModels: number;
  totalModels: number;
  earliestExpiresAtMs: number | null;
  latestObservedAtMs: number | null;
  latestObservedLength: number | null;
  models: AccountTurnTicketModelSummary[];
}

const KNOWN_STATES = new Set<CodexTurnTicketState>([
  'healthy',
  'partial',
  'expiring',
  'expired_or_invalid',
  'missing',
  'disabled',
  'not_scoped',
  'unavailable',
]);

const readBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const readNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const readTimestampMs = (value: unknown): number | null => {
  const numeric = readNumber(value);
  if (numeric !== null && numeric > 0) return numeric < 1e12 ? numeric * 1000 : numeric;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeState = (value: unknown): CodexTurnTicketState => {
  const state = readString(value) as CodexTurnTicketState;
  return KNOWN_STATES.has(state) ? state : 'unavailable';
};

const normalizeModel = (model: CodexTurnTicketModelSnapshot): AccountTurnTicketModelSummary => ({
  model: readString(model.model) || '-',
  ticketState: readString(model.ticket_state ?? model.ticketState) || 'missing',
  ticketLength: readNumber(model.ticket_length ?? model.ticketLength),
  expiresAtMs: readTimestampMs(model.expires_at ?? model.expiresAt),
  lastObservedAtMs: readTimestampMs(model.last_observed_at ?? model.lastObservedAt),
  lastHttpStatus: readNumber(model.last_http_status ?? model.lastHttpStatus),
  lastObservedLength: readNumber(model.last_observed_length ?? model.lastObservedLength),
  lastObservedHealthy: readBoolean(model.last_observed_healthy ?? model.lastObservedHealthy, false),
  lastResult: readString(model.last_result ?? model.lastResult),
});

const unavailableSummary = (applicable: boolean): AccountTurnTicketSummary => ({
  applicable,
  configured: false,
  enabled: false,
  harvesterActive: false,
  targetLength: 292,
  state: applicable ? 'unavailable' : 'not_applicable',
  healthyModels: 0,
  totalModels: 0,
  earliestExpiresAtMs: null,
  latestObservedAtMs: null,
  latestObservedLength: null,
  models: [],
});

export const resolveAccountTurnTicket = (
  file: AuthFileItem,
  provider: string
): AccountTurnTicketSummary => {
  if (provider !== 'codex') return unavailableSummary(false);

  const raw = (file.codex_turn_ticket ?? file.codexTurnTicket) as
    | CodexTurnTicketCredentialSnapshot
    | undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return unavailableSummary(true);

  const models = Array.isArray(raw.models)
    ? raw.models
        .filter(
          (model): model is CodexTurnTicketModelSnapshot =>
            Boolean(model) && typeof model === 'object' && !Array.isArray(model)
        )
        .map(normalizeModel)
    : [];
  const latestObservation = models.reduce<AccountTurnTicketModelSummary | null>((latest, model) => {
    if (model.lastObservedAtMs === null) return latest;
    if (!latest || (latest.lastObservedAtMs ?? 0) < model.lastObservedAtMs) return model;
    return latest;
  }, null);

  return {
    applicable: true,
    plan: readString(raw.plan),
    planSource: readString(raw.plan_source),
    configured: readBoolean(raw.configured, false),
    enabled: readBoolean(raw.enabled, false),
    harvesterActive: readBoolean(raw.harvester_active ?? raw.harvesterActive, false),
    targetLength: readNumber(raw.target_length ?? raw.targetLength) ?? 292,
    state: normalizeState(raw.state),
    healthyModels: readNumber(raw.healthy_models ?? raw.healthyModels) ?? 0,
    totalModels: readNumber(raw.total_models ?? raw.totalModels) ?? models.length,
    earliestExpiresAtMs: readTimestampMs(raw.earliest_expires_at ?? raw.earliestExpiresAt),
    latestObservedAtMs: latestObservation?.lastObservedAtMs ?? null,
    latestObservedLength: latestObservation?.lastObservedLength ?? null,
    models,
  };
};

export const accountTurnTicketMatchesFilter = (
  summary: AccountTurnTicketSummary | undefined,
  filter: AccountTurnTicketFilter | undefined
): boolean => {
  if (!filter || filter === 'all') return true;
  if (!summary?.applicable) return false;
  switch (filter) {
    case 'ready':
      return summary.state === 'healthy';
    case 'partial':
      return summary.state === 'partial' || summary.state === 'expiring';
    case 'missing':
      return summary.state === 'missing' || summary.state === 'expired_or_invalid';
    case 'unknown':
      return ['disabled', 'not_scoped', 'unavailable'].includes(summary.state);
    default:
      return true;
  }
};

export const getAccountTurnTicketRemaining = (
  expiresAtMs: number | null,
  nowMs = Date.now()
): { value: number; unit: 'minute' | 'hour' | 'day' } | null => {
  if (expiresAtMs === null || expiresAtMs <= nowMs) return null;
  const remainingMs = expiresAtMs - nowMs;
  if (remainingMs < 60 * 60 * 1000) {
    return { value: Math.max(1, Math.floor(remainingMs / (60 * 1000))), unit: 'minute' };
  }
  if (remainingMs < 24 * 60 * 60 * 1000) {
    return { value: Math.max(1, Math.floor(remainingMs / (60 * 60 * 1000))), unit: 'hour' };
  }
  return { value: Math.max(1, Math.floor(remainingMs / (24 * 60 * 60 * 1000))), unit: 'day' };
};
