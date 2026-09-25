import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GatewayMintStatus } from './GatewayMintStatus';
import { AccountTurnTicketStatus } from './AccountTurnTicketStatus';
import { resolveAccountTurnTicket } from '../model/accountTurnTicket';
import { gatewayMintEn } from '@/i18n/gatewayMint';

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) =>
      gatewayMintEn[key.replace('gateway_mint.', '') as keyof typeof gatewayMintEn] || key,
  }),
}));
const now = Date.UTC(2026, 8, 25);
const makeSummary = (websocket = false) =>
  resolveAccountTurnTicket(
    {
      name: 'local',
      codex_turn_ticket: {
        enabled: true,
        injection_enabled: false,
        configured: true,
        state: 'healthy',
        total_models: 1,
        models: [
          {
            model: 'A',
            routing_mode: 'direct',
            ticket_state: 'healthy',
            mint_states: {
              sse: {
                ready: true,
                model: 'A',
                gateway: 'unified-88',
                ticket_length: 780,
                ticket_expires_at: now + 3000,
                pair_expires_at: now + 9000,
              },
              ...(websocket
                ? {
                    websocket: {
                      ready: false,
                      status: 429,
                      reason: 'upstream_rejected',
                      next_attempt_at: now + 60000,
                    },
                  }
                : {}),
            },
          },
        ],
      },
    },
    'codex'
  );
let view: ReactTestRenderer | undefined;
afterEach(() => {
  if (view) act(() => view?.unmount());
  view = undefined;
  vi.useRealTimers();
});
describe('gateway mint display', () => {
  it('shows both transports and separate leases without natural-pass or intelligence claims', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    act(() => {
      view = create(<GatewayMintStatus summary={makeSummary(true)} detail />);
    });
    const text = JSON.stringify(view!.toJSON());
    expect(view!.root.findByProps({ 'data-mint-transport': 'sse' }).props['data-mint-ready']).toBe(
      true
    );
    expect(
      view!.root.findByProps({ 'data-mint-transport': 'websocket' }).props['data-mint-ready']
    ).toBe(false);
    for (const label of [
      'Ticket expires',
      'Routing pair expires',
      'Injection disabled / probe only',
      'Account rejected or rate-limited',
    ])
      expect(text).toContain(label);
    expect(text).not.toContain('Natural pass');
  });
  it('demotes a stale green badge without waiting for another account fetch', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    act(() => {
      view = create(
        <AccountTurnTicketStatus provider="codex" summary={makeSummary()} interactive={false} />
      );
    });
    expect(view!.root.findByProps({ 'data-turn-ticket-state': 'healthy' })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(view!.root.findByProps({ 'data-turn-ticket-state': 'expired_or_invalid' })).toBeTruthy();
  });
  it('retains the account detail button and does not label ready materials as already injected', () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const onOpen = vi.fn();
    act(() => {
      view = create(
        <AccountTurnTicketStatus provider="codex" summary={makeSummary(true)} onOpen={onOpen} />
      );
    });
    const button = view!.root.findByType('button');
    expect(button.props['data-turn-ticket-state']).toBe('partial');
    expect(button.props.title).toContain('probe only');
    expect(button.props.title).not.toContain('No injection required');
    act(() => button.props.onClick({ stopPropagation: vi.fn() }));
    expect(onOpen).toHaveBeenCalledOnce();
  });
  it.each(['not_scoped', 'unavailable', 'disabled'] as const)(
    'never shows a ready path for %s',
    (state) => {
      vi.useFakeTimers();
      vi.setSystemTime(now);
      const summary = { ...makeSummary(), state };
      act(() => {
        view = create(<GatewayMintStatus summary={summary} detail />);
      });
      expect(
        view!.root.findByProps({ 'data-mint-transport': 'sse' }).props['data-mint-ready']
      ).toBe(false);
    }
  );
});
