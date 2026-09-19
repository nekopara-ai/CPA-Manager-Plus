import { describe, expect, it } from 'vitest';
import {
  accountTurnTicketMatchesFilter,
  getAccountTurnTicketRemaining,
  resolveAccountTurnTicket,
} from './accountTurnTicket';

describe('accountTurnTicket', () => {
  it('normalizes a credential-scoped multi-model snapshot', () => {
    const summary = resolveAccountTurnTicket(
      {
        name: 'codex.json',
        type: 'codex',
        codex_turn_ticket: {
          configured: true,
          enabled: true,
          harvester_active: true,
          target_length: 292,
          state: 'partial',
          healthy_models: 1,
          total_models: 2,
          earliest_expires_at: '2026-09-19T20:47:00Z',
          models: [
            {
              model: 'gpt-5.6-sol',
              ticket_state: 'healthy',
              ticket_length: 292,
              expires_at: '2026-09-19T20:47:00Z',
              last_observed_at: '2026-09-19T20:00:00Z',
              last_http_status: 200,
              last_observed_length: 292,
              last_observed_healthy: true,
              last_result: 'healthy_ticket',
            },
            {
              model: 'gpt-5.6-luna',
              ticket_state: 'missing',
              last_observed_at: '2026-09-19T20:05:00Z',
              last_http_status: 200,
              last_observed_length: 312,
              last_observed_healthy: false,
              last_result: 'degraded_ticket',
            },
          ],
        },
      },
      'codex'
    );

    expect(summary).toMatchObject({
      applicable: true,
      state: 'partial',
      healthyModels: 1,
      totalModels: 2,
      latestObservedLength: 312,
    });
    expect(summary.models[0]).toMatchObject({
      model: 'gpt-5.6-sol',
      ticketLength: 292,
      lastHttpStatus: 200,
    });
    expect(accountTurnTicketMatchesFilter(summary, 'partial')).toBe(true);
    expect(accountTurnTicketMatchesFilter(summary, 'ready')).toBe(false);
  });

  it('distinguishes unavailable Codex data from non-Codex credentials', () => {
    expect(resolveAccountTurnTicket({ name: 'codex.json', type: 'codex' }, 'codex').state).toBe(
      'unavailable'
    );
    const claude = resolveAccountTurnTicket({ name: 'claude.json', type: 'claude' }, 'claude');
    expect(claude.state).toBe('not_applicable');
    expect(accountTurnTicketMatchesFilter(claude, 'unknown')).toBe(false);
  });

  it('formats the remaining lifetime into compact units', () => {
    const now = Date.UTC(2026, 8, 19, 20, 0, 0);
    expect(getAccountTurnTicketRemaining(now + 47 * 60_000, now)).toEqual({
      value: 47,
      unit: 'minute',
    });
    expect(getAccountTurnTicketRemaining(now + 3 * 60 * 60_000, now)).toEqual({
      value: 3,
      unit: 'hour',
    });
    expect(getAccountTurnTicketRemaining(now - 1, now)).toBeNull();
  });
});

it('uses backend Team policy for imported credentials without OAuth tokens', () => {
  const result = resolveAccountTurnTicket(
    {
      name: 'imported.json',
      type: 'codex',
      codex_turn_ticket: {
        configured: true,
        enabled: true,
        plan: 'team',
        plan_source: 'manual',
        target_length: 332,
        state: 'healthy',
        healthy_models: 1,
        total_models: 1,
        models: [{ model: 'gpt-6-astra', ticket_state: 'healthy', ticket_length: 332 }],
      },
    },
    'codex'
  );
  expect(result).toMatchObject({
    plan: 'team',
    planSource: 'manual',
    targetLength: 332,
    state: 'healthy',
  });
});
