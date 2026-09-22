import { useTranslation } from 'react-i18next';
import { useInterval } from '@/hooks/useInterval';
import { useState } from 'react';
import { formatTimestampTitle } from '@/features/accounts/model/accountsPagePresentation';
import {
  formatAccountTurnTicketLength,
  getAccountTurnTicketRemaining,
  isAccountTurnTicketRoutingActive,
  type AccountTurnTicketSummary,
} from '@/features/accounts/model/accountTurnTicket';
import styles from '../AccountsPage.module.scss';

interface AccountTurnTicketStatusProps {
  summary?: AccountTurnTicketSummary;
  provider: string;
  variant?: 'table' | 'card';
  interactive?: boolean;
  onOpen?: () => void;
}

const ROUTING_MODES = ['unknown', 'direct', 'inject', 'blocked'] as const;

const getToneClass = (state: AccountTurnTicketSummary['state'] | undefined): string => {
  switch (state) {
    case 'healthy':
    case 'direct':
      return styles.turnTicketToneHealthy;
    case 'partial':
    case 'expiring':
    case 'unclassified':
      return styles.turnTicketToneWarning;
    case 'missing':
    case 'expired_or_invalid':
    case 'blocked':
      return styles.turnTicketToneDanger;
    default:
      return styles.turnTicketToneNeutral;
  }
};

/** Returns the routing mode the backend reported for the credential, if uniform. */
const resolveRoutingMode = (summary: AccountTurnTicketSummary): string => {
  const modes = new Set(
    summary.models.map((model) => model.routingMode).filter((mode) => mode.length > 0)
  );
  return modes.size === 1 ? Array.from(modes)[0] : '';
};

/**
 * CPA folds natural passes into the aggregate `healthy` state, so the badge has to look at
 * the per-model routes to avoid claiming a harvested ticket that was never needed.
 */
const isNaturalPassOnly = (summary: AccountTurnTicketSummary): boolean =>
  summary.models.length > 0 &&
  summary.models.every((model) => model.routingMode === 'direct' || model.ticketState === 'direct');

const resolveRoutingLabelKey = (mode: string): string =>
  (ROUTING_MODES as readonly string[]).includes(mode) ? `accounts.turn_ticket_routing_${mode}` : '';

export function AccountTurnTicketStatus({
  summary,
  provider,
  variant = 'table',
  interactive = true,
  onOpen,
}: AccountTurnTicketStatusProps) {
  const { t, i18n } = useTranslation();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expiresAtMs = summary?.applicable ? summary.earliestExpiresAtMs : null;
  const remainingMs = expiresAtMs === null ? null : expiresAtMs - nowMs;

  // A short routing lease can expire inside a minute, so the badge keeps a live clock
  // instead of relying on the surrounding page refresh cadence. Long leases only
  // re-check occasionally so a large credential table does not tick every second.
  useInterval(
    () => setNowMs(Date.now()),
    remainingMs === null || remainingMs <= 0 ? null : remainingMs < 65_000 ? 1000 : 30_000
  );

  if (provider !== 'codex' || !summary?.applicable) {
    return (
      <span
        className={`${styles.turnTicketStatus} ${styles.turnTicketStatusNotApplicable}`}
        data-turn-ticket-state="not_applicable"
      >
        —
      </span>
    );
  }

  const targetLength = formatAccountTurnTicketLength(summary.targetLength);
  const naturalPassOnly = isNaturalPassOnly(summary);
  const routingMode = resolveRoutingMode(summary);
  const routingLabelKey = resolveRoutingLabelKey(routingMode);
  const routingText = routingLabelKey ? t(routingLabelKey) : '';
  const remaining = getAccountTurnTicketRemaining(expiresAtMs, nowMs);
  const remainingText = remaining
    ? t(`accounts.turn_ticket_remaining_${remaining.unit}`, {
        count: remaining.value,
        defaultValue: `${remaining.value}`,
      })
    : '';
  const stateLabel = (() => {
    switch (summary.state) {
      case 'healthy':
        return naturalPassOnly
          ? t('accounts.turn_ticket_state_direct', { defaultValue: 'Natural pass' })
          : t('accounts.turn_ticket_state_ready', {
              length: targetLength,
              defaultValue: `${targetLength} ready`,
            });
      case 'direct':
        return t('accounts.turn_ticket_state_direct', { defaultValue: 'Natural pass' });
      case 'blocked':
        return t('accounts.turn_ticket_state_blocked', { defaultValue: 'Blocked' });
      case 'partial':
        return t('accounts.turn_ticket_state_partial', {
          healthy: summary.healthyModels,
          total: summary.totalModels,
          defaultValue: `Partial ${summary.healthyModels}/${summary.totalModels}`,
        });
      case 'expiring':
        return t('accounts.turn_ticket_state_expiring', { defaultValue: 'Expiring' });
      case 'expired_or_invalid':
        return t('accounts.turn_ticket_state_expired', { defaultValue: 'Expired or invalid' });
      case 'missing':
        return t('accounts.turn_ticket_state_missing', {
          length: targetLength,
          defaultValue: `No healthy ${targetLength}`,
        });
      case 'unclassified':
        return t('accounts.turn_ticket_state_unclassified', {
          defaultValue: 'Awaiting classification',
        });
      case 'disabled':
        return t('accounts.turn_ticket_state_disabled', { defaultValue: 'Not enabled' });
      case 'not_scoped':
        return t('accounts.turn_ticket_state_not_scoped', { defaultValue: 'Out of scope' });
      default:
        return t('accounts.turn_ticket_state_unavailable', { defaultValue: 'Unavailable' });
    }
  })();
  const injected = summary.models.some((model) => isAccountTurnTicketRoutingActive(model));
  // The main label already states the uniform route, so do not repeat it underneath.
  const duplicatesMainLabel =
    (summary.state === 'direct' && routingMode === 'direct') ||
    (summary.state === 'blocked' && routingMode === 'blocked') ||
    (naturalPassOnly && routingMode === 'direct');
  const secondaryText =
    remainingText ||
    (duplicatesMainLabel ? '' : routingText) ||
    (summary.latestObservedLength !== null
      ? t('accounts.turn_ticket_last_probe_length', {
          length: summary.latestObservedLength,
          defaultValue: `Last probe: ${summary.latestObservedLength}`,
        })
      : summary.state === 'unavailable'
        ? t('accounts.turn_ticket_backend_required', { defaultValue: 'Backend data required' })
        : '');
  const titleParts = [stateLabel];
  if (routingText && !duplicatesMainLabel) titleParts.push(routingText);
  if (summary.plan) {
    titleParts.push(
      t('accounts.turn_ticket_plan_hint', {
        plan:
          summary.plan === 'team'
            ? 'Team / Business'
            : summary.plan === 'pro'
              ? 'Pro / Personal'
              : summary.plan,
        source: t(`accounts.turn_ticket_plan_source_${summary.planSource || 'config'}`),
      })
    );
  }
  if (summary.enabled) {
    titleParts.push(
      injected
        ? t('accounts.turn_ticket_injection_active', { defaultValue: 'Cookie injection active' })
        : t('accounts.turn_ticket_injection_idle', { defaultValue: 'No injection required' })
    );
  }
  if (summary.earliestExpiresAtMs !== null) {
    titleParts.push(
      t('accounts.turn_ticket_exact_expiry', {
        time: formatTimestampTitle(summary.earliestExpiresAtMs, i18n.language),
        defaultValue: `Expires: ${formatTimestampTitle(summary.earliestExpiresAtMs, i18n.language)}`,
      })
    );
  }
  if (summary.latestObservedAtMs !== null) {
    titleParts.push(
      t('accounts.turn_ticket_last_observed', {
        time: formatTimestampTitle(summary.latestObservedAtMs, i18n.language),
        defaultValue: `Last observed: ${formatTimestampTitle(summary.latestObservedAtMs, i18n.language)}`,
      })
    );
  }

  const content = (
    <>
      <span className={styles.turnTicketStatusMain}>
        <span className={styles.turnTicketStatusDot} aria-hidden="true" />
        <strong>{stateLabel}</strong>
      </span>
      {secondaryText ? <small>{secondaryText}</small> : null}
    </>
  );
  const className = [
    styles.turnTicketStatus,
    variant === 'card' ? styles.turnTicketStatusCard : styles.turnTicketStatusTable,
    getToneClass(summary.state),
  ]
    .filter(Boolean)
    .join(' ');

  if (!interactive || !onOpen) {
    return (
      <span
        className={className}
        title={titleParts.join(' · ')}
        data-turn-ticket-state={summary.state}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      title={titleParts.join(' · ')}
      data-turn-ticket-state={summary.state}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      {content}
    </button>
  );
}
