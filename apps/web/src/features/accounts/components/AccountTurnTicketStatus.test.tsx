import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { AccountTurnTicketStatus } from './AccountTurnTicketStatus';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === 'accounts.turn_ticket_state_ready') return `${values?.length} ready`;
      if (key === 'accounts.turn_ticket_last_probe_length') {
        return `Last probe: ${values?.length}`;
      }
      if (key === 'accounts.turn_ticket_routing_inject') return 'Injected';
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

const baseSummary = {
  applicable: true,
  configured: true,
  enabled: true,
  injectionEnabled: true,
  adaptiveInjection: true,
  harvesterActive: true,
  degradedLength: 312,
  blockOnDegraded: false,
  earliestExpiresAtMs: null as number | null,
  latestObservedAtMs: null as number | null,
  latestObservedLength: null as number | null,
  models: [] as never[],
};

describe('AccountTurnTicketStatus', () => {
  it('renders a healthy ticket as an interactive credential status', () => {
    const onOpen = vi.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <AccountTurnTicketStatus
          provider="codex"
          summary={{
            ...baseSummary,
            targetLength: 292,
            state: 'healthy',
            healthyModels: 2,
            totalModels: 2,
            latestObservedLength: 292,
          }}
          onOpen={onOpen}
        />
      );
    });

    const button = renderer!.root.findByType('button');
    expect(button.props['data-turn-ticket-state']).toBe('healthy');
    expect(button.findByType('strong').children.join('')).toBe('292 ready');
    act(() => button.props.onClick({ stopPropagation: vi.fn() }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('renders a natural pass without claiming cookie injection', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <AccountTurnTicketStatus
          provider="codex"
          summary={{
            ...baseSummary,
            targetLength: 780,
            state: 'direct',
            healthyModels: 1,
            totalModels: 1,
            models: [
              {
                model: 'gpt-5.6-sol',
                ticketState: 'direct',
                routingMode: 'direct',
                routingCookieNames: [],
                routingValidatedAtMs: null,
                routingExpiresAtMs: null,
                ticketLength: null,
                expiresAtMs: null,
                lastObservedAtMs: null,
                lastHttpStatus: null,
                lastObservedLength: null,
                lastObservedHealthy: true,
                lastResult: '',
                probeInFlight: false,
                probePhase: '',
                probeAttempts: null,
                lastProbeAtMs: null,
                lastProbePhase: '',
                lastProbeResult: '',
                lastProbeComplete: false,
                lastProbeModelMatch: false,
                nextProbeAtMs: null,
                probeBackoffUntilMs: null,
                harvestBackoffUntilMs: null,
              },
            ],
          }}
          interactive={false}
        />
      );
    });

    const status = renderer!.root.findByProps({ 'data-turn-ticket-state': 'direct' });
    expect(status.findByType('strong').children.join('')).toBe('accounts.turn_ticket_state_direct');
    // The main label already carries the route; it must not be printed twice.
    expect(status.findAllByType('small')).toHaveLength(0);
    expect(status.props.title).toContain('accounts.turn_ticket_injection_idle');
    expect(status.props.title).not.toContain('accounts.turn_ticket_injection_active');
  });

  it('keeps the ready label when a harvested ticket is actually injected', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <AccountTurnTicketStatus
          provider="codex"
          summary={{
            ...baseSummary,
            targetLength: 780,
            state: 'healthy',
            healthyModels: 1,
            totalModels: 1,
            models: [
              {
                model: 'gpt-6-astra',
                ticketState: 'healthy',
                routingMode: 'inject',
                routingCookieNames: ['oai-did'],
                routingValidatedAtMs: null,
                routingExpiresAtMs: null,
                ticketLength: 780,
                expiresAtMs: null,
                lastObservedAtMs: null,
                lastHttpStatus: null,
                lastObservedLength: null,
                lastObservedHealthy: true,
                lastResult: '',
                probeInFlight: false,
                probePhase: '',
                probeAttempts: null,
                lastProbeAtMs: null,
                lastProbePhase: '',
                lastProbeResult: '',
                lastProbeComplete: false,
                lastProbeModelMatch: false,
                nextProbeAtMs: null,
                probeBackoffUntilMs: null,
                harvestBackoffUntilMs: null,
              },
            ],
          }}
          interactive={false}
        />
      );
    });

    const status = renderer!.root.findByProps({ 'data-turn-ticket-state': 'healthy' });
    expect(status.findByType('strong').children.join('')).toBe('780 ready');
    expect(status.props.title).toContain('accounts.turn_ticket_injection_active');
  });

  it('counts down a short routing lease in seconds', () => {
    const now = Date.now();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <AccountTurnTicketStatus
          provider="codex"
          summary={{
            ...baseSummary,
            targetLength: 780,
            state: 'healthy',
            healthyModels: 1,
            totalModels: 1,
            earliestExpiresAtMs: now + 45_000,
          }}
          interactive={false}
        />
      );
    });

    const status = renderer!.root.findByProps({ 'data-turn-ticket-state': 'healthy' });
    expect(status.findByType('small').children.join('')).toBe(
      'accounts.turn_ticket_remaining_second'
    );
  });

  it('renders non-Codex credentials as not applicable', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<AccountTurnTicketStatus provider="claude" />);
    });

    expect(renderer!.root.findByProps({ 'data-turn-ticket-state': 'not_applicable' })).toBeTruthy();
    expect(renderer!.root.findAllByType('button')).toHaveLength(0);
  });
});
