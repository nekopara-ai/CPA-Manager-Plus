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
  'unclassified',
  'blocked',
  'unknown',
] as const;

export type AccountTurnTicketFilter = (typeof ACCOUNT_TURN_TICKET_FILTERS)[number];
export type AccountTurnTicketDisplayState = CodexTurnTicketState | 'not_applicable';
export type AccountTurnTicketRemainingUnit = 'second' | 'minute' | 'hour' | 'day';

export interface AccountTurnTicketModelSummary {
  model: string;
  ticketState: string;
  routingMode: string;
  routingCookieNames: string[];
  routingValidatedAtMs: number | null;
  routingExpiresAtMs: number | null;
  ticketLength: number | null;
  expiresAtMs: number | null;
  lastObservedAtMs: number | null;
  lastHttpStatus: number | null;
  lastObservedLength: number | null;
  lastObservedHealthy: boolean;
  lastResult: string;
  probeInFlight: boolean;
  probePhase: string;
  probeAttempts: number | null;
  lastProbeAtMs: number | null;
  lastProbePhase: string;
  lastProbeResult: string;
  lastProbeComplete: boolean;
  lastProbeModelMatch: boolean;
  nextProbeAtMs: number | null;
  probeBackoffUntilMs: number | null;
  harvestBackoffUntilMs: number | null;
}

export interface AccountTurnTicketSummary {
  plan?: string;
  planSource?: string;
  applicable: boolean;
  configured: boolean;
  enabled: boolean;
  injectionEnabled: boolean;
  adaptiveInjection: boolean;
  harvesterActive: boolean;
  targetLength: number;
  degradedLength: number | null;
  blockOnDegraded: boolean;
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
  'direct',
  'blocked',
  'partial',
  'expiring',
  'expired_or_invalid',
  'missing',
  'unclassified',
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

const readStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => readString(item)).filter((item) => item.length > 0);
};

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
  routingMode: readString(model.routing_mode ?? model.routingMode),
  routingCookieNames: readStringList(model.routing_cookie_names ?? model.routingCookieNames),
  routingValidatedAtMs: readTimestampMs(model.routing_validated_at ?? model.routingValidatedAt),
  routingExpiresAtMs: readTimestampMs(model.routing_expires_at ?? model.routingExpiresAt),
  ticketLength: readNumber(model.ticket_length ?? model.ticketLength),
  expiresAtMs: readTimestampMs(model.expires_at ?? model.expiresAt),
  lastObservedAtMs: readTimestampMs(model.last_observed_at ?? model.lastObservedAt),
  lastHttpStatus: readNumber(model.last_http_status ?? model.lastHttpStatus),
  lastObservedLength: readNumber(model.last_observed_length ?? model.lastObservedLength),
  lastObservedHealthy: readBoolean(model.last_observed_healthy ?? model.lastObservedHealthy, false),
  lastResult: readString(model.last_result ?? model.lastResult),
  probeInFlight: readBoolean(model.probe_in_flight ?? model.probeInFlight, false),
  probePhase: readString(model.probe_phase ?? model.probePhase),
  probeAttempts: readNumber(model.probe_attempts ?? model.probeAttempts),
  lastProbeAtMs: readTimestampMs(model.last_probe_at ?? model.lastProbeAt),
  lastProbePhase: readString(model.last_probe_phase ?? model.lastProbePhase),
  lastProbeResult: readString(model.last_probe_result ?? model.lastProbeResult),
  lastProbeComplete: readBoolean(model.last_probe_complete ?? model.lastProbeComplete, false),
  lastProbeModelMatch: readBoolean(
    model.last_probe_model_match ?? model.lastProbeModelMatch,
    false
  ),
  nextProbeAtMs: readTimestampMs(model.next_probe_at ?? model.nextProbeAt),
  probeBackoffUntilMs: readTimestampMs(model.probe_backoff_until ?? model.probeBackoffUntil),
  harvestBackoffUntilMs: readTimestampMs(model.harvest_backoff_until ?? model.harvestBackoffUntil),
});

const unavailableSummary = (applicable: boolean): AccountTurnTicketSummary => ({
  applicable,
  configured: false,
  enabled: false,
  injectionEnabled: false,
  adaptiveInjection: false,
  harvesterActive: false,
  targetLength: 0,
  degradedLength: null,
  blockOnDegraded: false,
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
    injectionEnabled: readBoolean(raw.injection_enabled ?? raw.injectionEnabled, false),
    adaptiveInjection: readBoolean(raw.adaptive_injection ?? raw.adaptiveInjection, false),
    harvesterActive: readBoolean(raw.harvester_active ?? raw.harvesterActive, false),
    targetLength: readNumber(raw.target_length ?? raw.targetLength) ?? 0,
    degradedLength: readNumber(raw.degraded_length ?? raw.degradedLength),
    blockOnDegraded: readBoolean(raw.block_on_degraded ?? raw.blockOnDegraded, false),
    state: normalizeState(raw.state),
    healthyModels: readNumber(raw.healthy_models ?? raw.healthyModels) ?? 0,
    totalModels: readNumber(raw.total_models ?? raw.totalModels) ?? models.length,
    earliestExpiresAtMs: readTimestampMs(raw.earliest_expires_at ?? raw.earliestExpiresAt),
    latestObservedAtMs: latestObservation?.lastObservedAtMs ?? null,
    latestObservedLength: latestObservation?.lastObservedLength ?? null,
    models,
  };
};

/** Natural pass: the upstream request was accepted without cookie injection. */
export const isAccountTurnTicketNaturalPass = (state: string | undefined): boolean =>
  state === 'direct';

/** Ready means every target model is either Healthy or a natural pass. */
export const isAccountTurnTicketReady = (summary: AccountTurnTicketSummary | undefined): boolean =>
  summary?.state === 'healthy' || summary?.state === 'direct';

/** Injecting means a validated routing-cookie combination is in use for this model. */
export const isAccountTurnTicketRoutingActive = (
  model: Pick<AccountTurnTicketModelSummary, 'routingMode' | 'ticketState'>
): boolean =>
  model.routingMode === 'inject' || (!model.routingMode && model.ticketState === 'healthy');

export const hasAccountTurnTicketBackoff = (
  model: AccountTurnTicketModelSummary,
  nowMs = Date.now()
): boolean =>
  (model.probeBackoffUntilMs ?? 0) > nowMs || (model.harvestBackoffUntilMs ?? 0) > nowMs;

export const accountTurnTicketMatchesFilter = (
  summary: AccountTurnTicketSummary | undefined,
  filter: AccountTurnTicketFilter | undefined
): boolean => {
  if (!filter || filter === 'all') return true;
  if (!summary?.applicable) return false;
  switch (filter) {
    case 'ready':
      return summary.state === 'healthy' || summary.state === 'direct';
    case 'partial':
      return summary.state === 'partial' || summary.state === 'expiring';
    case 'missing':
      return summary.state === 'missing' || summary.state === 'expired_or_invalid';
    case 'unclassified':
      return summary.state === 'unclassified';
    case 'blocked':
      return summary.state === 'blocked';
    case 'unknown':
      return ['disabled', 'not_scoped', 'unavailable'].includes(summary.state);
    default:
      return true;
  }
};

export const getAccountTurnTicketRemaining = (
  expiresAtMs: number | null,
  nowMs = Date.now()
): { value: number; unit: AccountTurnTicketRemainingUnit } | null => {
  if (expiresAtMs === null || expiresAtMs <= nowMs) return null;
  const remainingMs = expiresAtMs - nowMs;
  if (remainingMs < 60 * 1000) {
    return { value: Math.max(1, Math.floor(remainingMs / 1000)), unit: 'second' };
  }
  if (remainingMs < 60 * 60 * 1000) {
    return { value: Math.max(1, Math.floor(remainingMs / (60 * 1000))), unit: 'minute' };
  }
  if (remainingMs < 24 * 60 * 60 * 1000) {
    return { value: Math.max(1, Math.floor(remainingMs / (60 * 60 * 1000))), unit: 'hour' };
  }
  return { value: Math.max(1, Math.floor(remainingMs / (24 * 60 * 60 * 1000))), unit: 'day' };
};

/** Ticket length comes from the backend policy; do not invent a value when it is absent. */
export const formatAccountTurnTicketLength = (length: number): string =>
  length > 0 ? String(length) : '\u2014';
