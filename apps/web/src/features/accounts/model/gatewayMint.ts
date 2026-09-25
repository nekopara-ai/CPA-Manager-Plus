import type { CodexTurnTicketModelSnapshot } from '@/types';
import type { AccountTurnTicketSummary } from './accountTurnTicket';

export interface MintTransportState {
  transport: 'sse' | 'websocket';
  ready: boolean;
  gateway: string;
  model: string;
  ticketLength: number | null;
  ticketExpiresAtMs: number | null;
  pairExpiresAtMs: number | null;
  observedAtMs: number | null;
  nextAttemptAtMs: number | null;
  attempts: number | null;
  status: number | null;
  reason: string;
  inFlight: boolean;
}
const number = (v: unknown): number | null =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
const text = (v: unknown): string => (typeof v === 'string' ? v.slice(0, 160) : '');
export const mintTimestamp = (v: unknown): number | null => {
  if (typeof v === 'string' && /^0001-/.test(v)) return null;
  const time =
    typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(time) && time > 0 && time <= 8.64e15 ? time : null;
};

/** Presence selects the new contract, even if malformed/empty. Never fall back to length-only green. */
export function normalizeMintStates(
  model: CodexTurnTicketModelSnapshot
): MintTransportState[] | undefined {
  if (
    !Object.prototype.hasOwnProperty.call(model, 'mint_states') &&
    !Object.prototype.hasOwnProperty.call(model, 'mintStates')
  )
    return undefined;
  const raw = model.mint_states ?? model.mintStates;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return (['sse', 'websocket'] as const).flatMap((transport) => {
    if (!Object.prototype.hasOwnProperty.call(raw, transport)) return [];
    const candidate = raw[transport];
    const state =
      candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? candidate : {};
    return [
      {
        transport,
        ready: state.ready === true,
        gateway: text(state.gateway),
        model: text(state.model),
        ticketLength: number(state.ticket_length),
        ticketExpiresAtMs: mintTimestamp(state.ticket_expires_at),
        pairExpiresAtMs: mintTimestamp(state.pair_expires_at),
        observedAtMs: mintTimestamp(state.observed_at),
        nextAttemptAtMs: mintTimestamp(state.next_attempt_at),
        attempts: number(state.attempts),
        status: number(state.status),
        reason: text(state.reason),
        inFlight: state.in_flight === true,
      },
    ];
  });
}

/** Can only demote the server's as-of readiness, never promote it from lengths/model names. */
export const mintReady = (state: MintTransportState, now = Date.now()): boolean =>
  state.ready && (state.ticketExpiresAtMs ?? 0) > now && (state.pairExpiresAtMs ?? 0) > now;

export function gatewayReadiness(
  summary: AccountTurnTicketSummary,
  now = Date.now()
): Pick<
  AccountTurnTicketSummary,
  'state' | 'healthyModels' | 'totalModels' | 'earliestExpiresAtMs'
> & { readyTransports: number; totalTransports: number } {
  const transports = summary.models.flatMap((model) => model.mintStates ?? []);
  const ready = transports.filter((state) => mintReady(state, now));
  const healthyModels = summary.models.filter(
    (model) => model.mintStates?.length && model.mintStates.every((state) => mintReady(state, now))
  ).length;
  const totalModels = Math.max(summary.models.length, summary.totalModels);
  const earliestExpiresAtMs = ready.length
    ? Math.min(...ready.flatMap((state) => [state.ticketExpiresAtMs!, state.pairExpiresAtMs!]))
    : null;
  const explicitOff = ['disabled', 'not_scoped', 'unavailable'].includes(summary.state);
  const state = !summary.configured
    ? 'unavailable'
    : explicitOff
      ? summary.state
      : !summary.enabled
        ? 'disabled'
        : totalModels > 0 && healthyModels === totalModels
          ? 'healthy'
          : ready.length > 0
            ? 'partial'
            : transports.some(
                  (s) =>
                    s.ready &&
                    ((s.ticketExpiresAtMs ?? Infinity) <= now ||
                      (s.pairExpiresAtMs ?? Infinity) <= now)
                )
              ? 'expired_or_invalid'
              : 'missing';
  return {
    state,
    healthyModels,
    totalModels,
    earliestExpiresAtMs,
    readyTransports: ready.length,
    totalTransports: transports.length,
  };
}
