import { describe, expect, it } from 'vitest';
import {
  accountTurnTicketMatchesFilter,
  countAccountTurnTicketBlockedModels,
  getAccountTurnTicketRemaining,
  hasAccountTurnTicketBackoff,
  isAccountTurnTicketReady,
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

  it('counts a short routing lease down to seconds instead of rounding up a minute', () => {
    const now = Date.UTC(2026, 8, 23, 5, 0, 0);
    expect(getAccountTurnTicketRemaining(now + 44_000, now)).toEqual({
      value: 44,
      unit: 'second',
    });
    expect(getAccountTurnTicketRemaining(now + 59_999, now)).toEqual({
      value: 59,
      unit: 'second',
    });
    expect(getAccountTurnTicketRemaining(now + 60_000, now)).toEqual({
      value: 1,
      unit: 'minute',
    });
  });

  it('normalizes .145 adaptive fields and treats a natural pass as ready', () => {
    const summary = resolveAccountTurnTicket(
      {
        name: 'adaptive.json',
        type: 'codex',
        codex_turn_ticket: {
          configured: true,
          enabled: true,
          injection_enabled: true,
          adaptive_injection: true,
          harvester_active: true,
          target_length: 780,
          degraded_length: 312,
          block_on_degraded: true,
          state: 'healthy',
          healthy_models: 2,
          total_models: 2,
          models: [
            {
              model: 'gpt-5.6-sol',
              ticket_state: 'direct',
              routing_mode: 'direct',
              last_observed_at: '2026-09-23T05:00:00Z',
              last_observed_length: 780,
              last_observed_healthy: true,
              probe_in_flight: false,
              probe_attempts: 3,
              last_probe_complete: true,
              last_probe_model_match: true,
              next_probe_at: '2026-09-23T05:05:00Z',
            },
            {
              model: 'gpt-6-astra',
              ticket_state: 'healthy',
              routing_mode: 'inject',
              routing_cookie_names: ['__Secure-next-auth.session-token', 'oai-did'],
              routing_validated_at: '2026-09-23T04:59:00Z',
              routing_expires_at: '2026-09-23T05:04:00Z',
              ticket_length: 780,
              expires_at: '2026-09-23T05:04:00Z',
              probe_backoff_until: '2026-09-23T05:02:00Z',
            },
          ],
        },
      },
      'codex'
    );

    expect(summary).toMatchObject({
      targetLength: 780,
      degradedLength: 312,
      blockOnDegraded: true,
      injectionEnabled: true,
      adaptiveInjection: true,
      state: 'healthy',
      latestObservedLength: 780,
    });
    expect(isAccountTurnTicketReady(summary)).toBe(true);
    expect(summary.models[0]).toMatchObject({
      ticketState: 'direct',
      routingMode: 'direct',
      probeAttempts: 3,
      lastProbeComplete: true,
      lastProbeModelMatch: true,
    });
    expect(summary.models[1].routingCookieNames).toEqual([
      '__Secure-next-auth.session-token',
      'oai-did',
    ]);
    expect(hasAccountTurnTicketBackoff(summary.models[1], Date.parse('2026-09-23T05:01:00Z'))).toBe(
      true
    );
    expect(hasAccountTurnTicketBackoff(summary.models[1], Date.parse('2026-09-23T05:03:00Z'))).toBe(
      false
    );
  });

  it('keeps unclassified and blocked distinct from unavailable', () => {
    const build = (state: string, ticketState: string) =>
      resolveAccountTurnTicket(
        {
          name: `${state}.json`,
          type: 'codex',
          codex_turn_ticket: {
            configured: true,
            enabled: true,
            adaptive_injection: true,
            target_length: 780,
            degraded_length: 312,
            state,
            total_models: 1,
            models: [{ model: 'gpt-5.6-sol', ticket_state: ticketState, routing_mode: state }],
          },
        },
        'codex'
      );

    const unclassified = build('unclassified', 'unclassified');
    expect(unclassified.state).toBe('unclassified');
    expect(accountTurnTicketMatchesFilter(unclassified, 'unclassified')).toBe(true);
    expect(accountTurnTicketMatchesFilter(unclassified, 'unknown')).toBe(false);
    expect(accountTurnTicketMatchesFilter(unclassified, 'ready')).toBe(false);

    const blocked = build('blocked', 'blocked');
    expect(blocked.state).toBe('blocked');
    expect(accountTurnTicketMatchesFilter(blocked, 'blocked')).toBe(true);
    expect(accountTurnTicketMatchesFilter(blocked, 'missing')).toBe(false);
  });

  it('promotes a fully policy-blocked credential that CPA rolled up as missing', () => {
    const summary = resolveAccountTurnTicket(
      {
        name: 'blocked-credential.json',
        type: 'codex',
        codex_turn_ticket: {
          configured: true,
          enabled: true,
          adaptive_injection: true,
          block_on_degraded: true,
          target_length: 780,
          degraded_length: 312,
          state: 'missing',
          total_models: 2,
          models: [
            { model: 'gpt-5.6-sol', ticket_state: 'blocked', routing_mode: 'blocked' },
            { model: 'gpt-6-astra', ticket_state: 'blocked', routing_mode: 'blocked' },
          ],
        },
      },
      'codex'
    );

    expect(countAccountTurnTicketBlockedModels(summary)).toBe(2);
    expect(summary.state).toBe('blocked');
    expect(accountTurnTicketMatchesFilter(summary, 'blocked')).toBe(true);
    expect(accountTurnTicketMatchesFilter(summary, 'missing')).toBe(false);
  });

  it('keeps a partially blocked credential on its reported aggregate state', () => {
    const summary = resolveAccountTurnTicket(
      {
        name: 'partially-blocked.json',
        type: 'codex',
        codex_turn_ticket: {
          configured: true,
          enabled: true,
          adaptive_injection: true,
          target_length: 780,
          state: 'missing',
          total_models: 2,
          models: [
            { model: 'gpt-5.6-sol', ticket_state: 'blocked', routing_mode: 'blocked' },
            { model: 'gpt-6-astra', ticket_state: 'missing' },
          ],
        },
      },
      'codex'
    );

    expect(countAccountTurnTicketBlockedModels(summary)).toBe(1);
    expect(summary.state).toBe('missing');
    expect(accountTurnTicketMatchesFilter(summary, 'blocked')).toBe(true);
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
