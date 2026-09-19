import { useTranslation } from 'react-i18next';
import { formatTimestampTitle } from '@/features/accounts/model/accountsPagePresentation';
import {
  getAccountTurnTicketRemaining,
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

const getToneClass = (state: AccountTurnTicketSummary['state'] | undefined): string => {
  switch (state) {
    case 'healthy':
      return styles.turnTicketToneHealthy;
    case 'partial':
    case 'expiring':
      return styles.turnTicketToneWarning;
    case 'missing':
    case 'expired_or_invalid':
      return styles.turnTicketToneDanger;
    default:
      return styles.turnTicketToneNeutral;
  }
};

export function AccountTurnTicketStatus({
  summary,
  provider,
  variant = 'table',
  interactive = true,
  onOpen,
}: AccountTurnTicketStatusProps) {
  const { t, i18n } = useTranslation();
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

  const targetLength = summary.targetLength || 292;
  const remaining = getAccountTurnTicketRemaining(summary.earliestExpiresAtMs);
  const remainingText = remaining
    ? t(`accounts.turn_ticket_remaining_${remaining.unit}`, {
        count: remaining.value,
        defaultValue: `${remaining.value}`,
      })
    : '';
  const stateLabel = (() => {
    switch (summary.state) {
      case 'healthy':
        return t('accounts.turn_ticket_state_ready', {
          length: targetLength,
          defaultValue: `${targetLength} ready`,
        });
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
      case 'disabled':
        return t('accounts.turn_ticket_state_disabled', { defaultValue: 'Not enabled' });
      case 'not_scoped':
        return t('accounts.turn_ticket_state_not_scoped', { defaultValue: 'Out of scope' });
      default:
        return t('accounts.turn_ticket_state_unavailable', { defaultValue: 'Unavailable' });
    }
  })();
  const secondaryText =
    remainingText ||
    (summary.latestObservedLength !== null
      ? t('accounts.turn_ticket_last_probe_length', {
          length: summary.latestObservedLength,
          defaultValue: `Last probe: ${summary.latestObservedLength}`,
        })
      : summary.state === 'unavailable'
        ? t('accounts.turn_ticket_backend_required', { defaultValue: 'Backend data required' })
        : '');
  const titleParts = [stateLabel];
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
