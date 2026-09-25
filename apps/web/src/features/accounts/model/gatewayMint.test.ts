import { describe, expect, it } from 'vitest';
import {
  resolveAccountTurnTicket,
  accountTurnTicketMatchesFilter,
  isAccountTurnTicketReady,
} from './accountTurnTicket';
import { gatewayReadiness, mintTimestamp, normalizeMintStates } from './gatewayMint';
import type { AuthFileItem, CodexMintSnapshot, CodexTurnTicketModelSnapshot } from '@/types';

const future = Date.now() + 3600000;
const good: CodexMintSnapshot = {
  ready: true,
  gateway: 'unified-88',
  model: 'A',
  ticket_length: 780,
  ticket_expires_at: future,
  pair_expires_at: future + 3600000,
  status: 200,
};
export const file = (states: CodexTurnTicketModelSnapshot['mint_states']): AuthFileItem => ({
  name: 'test',
  type: 'codex',
  codex_turn_ticket: {
    configured: true,
    enabled: true,
    injection_enabled: true,
    state: 'healthy',
    healthy_models: 1,
    total_models: 1,
    models: [
      {
        model: 'A',
        ticket_state: 'healthy',
        routing_mode: 'direct',
        ticket_length: 780,
        mint_states: states,
      },
    ],
  },
});

describe('gateway mint contract', () => {
  it('does not infer readiness from identical model, length, direct route or legacy rollup', () => {
    const summary = resolveAccountTurnTicket(
      file({
        sse: { ...good, ready: false, gateway: 'unified-12', reason: 'gateway_or_pair_mismatch' },
      }),
      'codex'
    );
    expect(summary.gatewayMint).toBe(true);
    expect(summary.state).toBe('missing');
    expect(isAccountTurnTicketReady(summary)).toBe(false);
    expect(accountTurnTicketMatchesFilter(summary, 'ready')).toBe(false);
  });
  it('requires every reported transport per model instead of the legacy any-transport rollup', () => {
    const summary = resolveAccountTurnTicket(
      file({ sse: good, websocket: { ...good, ready: false } }),
      'codex'
    );
    expect(summary).toMatchObject({ state: 'partial', healthyModels: 0, totalModels: 1 });
    expect(gatewayReadiness(summary)).toMatchObject({ readyTransports: 1, totalTransports: 2 });
    expect(accountTurnTicketMatchesFilter(summary, 'partial')).toBe(true);
  });
  it('does not invent an absent WebSocket transport', () => {
    const summary = resolveAccountTurnTicket(file({ sse: good }), 'codex');
    expect(summary.state).toBe('healthy');
    expect(summary.models[0].mintStates).toHaveLength(1);
  });
  it('expires either independent lease and recomputes filters from the clock', () => {
    const summary = resolveAccountTurnTicket(file({ sse: good }), 'codex');
    expect(gatewayReadiness(summary, future + 1).state).toBe('expired_or_invalid');
    const expiredPair = resolveAccountTurnTicket(
      file({ sse: { ...good, pair_expires_at: Date.now() - 1 } }),
      'codex'
    );
    expect(expiredPair.state).toBe('expired_or_invalid');
    expect(accountTurnTicketMatchesFilter(expiredPair, 'ready')).toBe(false);
  });
  it('never resurrects readiness during rejection/backoff even when cached leases remain live', () => {
    const summary = resolveAccountTurnTicket(
      file({ sse: { ...good, ready: false, status: 429, next_attempt_at: future } }),
      'codex'
    );
    expect(summary.state).toBe('missing');
  });
  it.each([{}, null, { sse: null }, { sse: { ready: 'true' } }])(
    'treats malformed new payload as non-ready: %j',
    (states) => {
      const summary = resolveAccountTurnTicket(file(states as never), 'codex');
      expect(summary.gatewayMint).toBe(true);
      expect(summary.state).toBe('missing');
    }
  );
  it('keeps old backends and explicit scope/disable state compatible', () => {
    const old = file(undefined);
    delete old.codex_turn_ticket!.models![0].mint_states;
    expect(resolveAccountTurnTicket(old, 'codex')).toMatchObject({
      gatewayMint: false,
      state: 'healthy',
    });
    const disabled = file({ sse: good });
    disabled.codex_turn_ticket!.state = 'disabled';
    disabled.codex_turn_ticket!.enabled = false;
    expect(resolveAccountTurnTicket(disabled, 'codex').state).toBe('disabled');
    disabled.codex_turn_ticket!.state = 'not_scoped';
    expect(resolveAccountTurnTicket(disabled, 'codex').state).toBe('not_scoped');
  });
  it('treats zero Go times and invalid timestamps as unavailable, not year-one expirations', () => {
    for (const value of ['0001-01-01T00:00:00Z', 'bad', 0, -1, Infinity])
      expect(mintTimestamp(value)).toBeNull();
    expect(mintTimestamp('2026-09-25T00:00:00Z')).toBe(Date.UTC(2026, 8, 25));
  });
  it('does not retain raw tokens, cookies or arbitrary nested data', () => {
    const states = normalizeMintStates({
      mint_states: { sse: { ...good, token: 'secret', cookies: 'secret' } },
    } as never);
    expect(JSON.stringify(states)).not.toContain('secret');
  });
  it('cannot let a model with missing transport data make all models ready', () => {
    const raw = file({ sse: good });
    raw.codex_turn_ticket!.models!.push({ model: 'B', ticket_state: 'healthy' });
    expect(resolveAccountTurnTicket(raw, 'codex').state).toBe('partial');
  });
  it('does not promote cached transport data when the subsystem is not configured', () => {
    const raw = file({ sse: good });
    raw.codex_turn_ticket!.configured = false;
    expect(resolveAccountTurnTicket(raw, 'codex').state).toBe('unavailable');
  });
});
