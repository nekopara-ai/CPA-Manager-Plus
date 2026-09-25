import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useInterval } from '@/hooks/useInterval';
import type { AccountTurnTicketSummary } from '../model/accountTurnTicket';
import { gatewayReadiness, mintReady } from '../model/gatewayMint';
import { formatTimestampTitle } from '../model/accountsPagePresentation';
import styles from './GatewayMintStatus.module.scss';

export function GatewayMintStatus({
  summary,
  detail = false,
  onOpen,
}: {
  summary: AccountTurnTicketSummary;
  detail?: boolean;
  onOpen?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [now, setNow] = useState(Date.now);
  const nextChange = summary.models
    .flatMap((model) => model.mintStates ?? [])
    .flatMap((state) => [state.ticketExpiresAtMs, state.pairExpiresAtMs, state.nextAttemptAtMs])
    .filter((time): time is number => time !== null && time > now);
  const nextMs = nextChange.length ? Math.min(...nextChange) - now : null;
  useInterval(() => setNow(Date.now()), nextMs === null ? null : nextMs < 65_000 ? 1000 : 30_000);
  const status = gatewayReadiness(summary, now);
  const key = ['healthy', 'partial', 'missing', 'expired_or_invalid'].includes(status.state)
    ? `gateway_mint.state_${status.state}`
    : `accounts.turn_ticket_state_${status.state}`;
  const label = t(key);
  const mode = t(
    summary.injectionEnabled ? 'gateway_mint.injection_enabled' : 'gateway_mint.probe_only'
  );
  const title = `${label} · ${mode} · ${t('gateway_mint.boundary')}`;
  const badge = (
    <>
      <strong>{label}</strong>
      <small>
        {t('gateway_mint.paths', {
          ready: status.readyTransports,
          total: status.totalTransports,
        })}
      </small>
    </>
  );
  const tone =
    status.state === 'healthy' ? styles.ready : status.state === 'partial' ? styles.partial : '';
  const date = (value: number | null) =>
    value === null ? '—' : formatTimestampTitle(value, i18n.language);
  if (!detail)
    return onOpen ? (
      <button
        type="button"
        className={`${styles.badge} ${tone}`}
        title={title}
        data-turn-ticket-state={status.state}
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        {badge}
      </button>
    ) : (
      <span
        className={`${styles.badge} ${tone}`}
        title={title}
        data-turn-ticket-state={status.state}
      >
        {badge}
      </span>
    );
  return (
    <div className={styles.detail} data-gateway-mint="true">
      <p>{t('gateway_mint.boundary')}</p>
      <p>{mode}</p>
      <p className={styles.muted}>{t('gateway_mint.scope_note')}</p>
      {summary.models.map((model) => (
        <section key={model.model} className={styles.model} data-turn-ticket-model={model.model}>
          <h4>{model.model}</h4>
          {(model.mintStates?.length ?? 0) === 0 ? <p>{t('gateway_mint.not_reported')}</p> : null}
          <div className={styles.transports}>
            {model.mintStates?.map((state) => {
              const ready = mintReady(state, now);
              const enabled =
                summary.configured &&
                summary.enabled &&
                !['not_scoped', 'disabled', 'unavailable'].includes(summary.state);
              const stateKey = !enabled
                ? `accounts.turn_ticket_state_${!summary.configured ? 'unavailable' : summary.state === 'not_scoped' || summary.state === 'unavailable' ? summary.state : 'disabled'}`
                : ready
                  ? 'gateway_mint.state_healthy'
                  : state.inFlight
                    ? 'gateway_mint.acquiring'
                    : (state.nextAttemptAtMs ?? 0) > now
                      ? 'gateway_mint.backoff'
                      : state.ready &&
                          ((state.ticketExpiresAtMs ?? Infinity) <= now ||
                            (state.pairExpiresAtMs ?? Infinity) <= now)
                        ? 'gateway_mint.state_expired_or_invalid'
                        : 'gateway_mint.state_missing';
              const reasonKey = `gateway_mint.reason_${state.reason}`;
              return (
                <article
                  key={state.transport}
                  className={styles.transport}
                  data-mint-transport={state.transport}
                  data-mint-ready={ready && enabled}
                >
                  <header>
                    <strong>{state.transport === 'sse' ? 'HTTP / SSE' : 'WebSocket'}</strong>
                    <span className={ready && enabled ? styles.readyText : ''}>{t(stateKey)}</span>
                  </header>
                  <dl>
                    {[
                      ['gateway', state.gateway || '—'],
                      ['accepted_model', state.model || '—'],
                      ['ticket_length', state.ticketLength ?? '—'],
                      ['ticket_expiry', date(state.ticketExpiresAtMs)],
                      ['pair_expiry', date(state.pairExpiresAtMs)],
                      ['observed', date(state.observedAtMs)],
                      ['attempts', state.attempts ?? '—'],
                      ['http_status', state.status || '—'],
                      ['next_attempt', date(state.nextAttemptAtMs)],
                      [
                        'last_reason',
                        state.reason
                          ? t(reasonKey, { defaultValue: t('gateway_mint.reason_unknown') })
                          : '—',
                      ],
                    ].map(([name, value]) => (
                      <div key={name}>
                        <dt>{t(`gateway_mint.${name}`)}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
