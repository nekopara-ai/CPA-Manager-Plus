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
      return key;
    },
    i18n: { language: 'en' },
  }),
}));

describe('AccountTurnTicketStatus', () => {
  it('renders a healthy ticket as an interactive credential status', () => {
    const onOpen = vi.fn();
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(
        <AccountTurnTicketStatus
          provider="codex"
          summary={{
            applicable: true,
            configured: true,
            enabled: true,
            harvesterActive: true,
            targetLength: 292,
            state: 'healthy',
            healthyModels: 2,
            totalModels: 2,
            earliestExpiresAtMs: null,
            latestObservedAtMs: null,
            latestObservedLength: 292,
            models: [],
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

  it('renders non-Codex credentials as not applicable', () => {
    let renderer: ReactTestRenderer;
    act(() => {
      renderer = create(<AccountTurnTicketStatus provider="claude" />);
    });

    expect(renderer!.root.findByProps({ 'data-turn-ticket-state': 'not_applicable' })).toBeTruthy();
    expect(renderer!.root.findAllByType('button')).toHaveLength(0);
  });
});
