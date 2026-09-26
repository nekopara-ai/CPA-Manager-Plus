import { useTranslation } from 'react-i18next';
import {
  fingerprintModelCounts,
  resolveFingerprintModels,
  type AccountFingerprintSummary,
} from '../model/accountFingerprint';
import styles from '../AccountsPage.module.scss';
interface Props {
  summary?: AccountFingerprintSummary;
  provider: string;
  variant?: 'table' | 'card';
  interactive?: boolean;
  onOpen?: () => void;
}
export function AccountFingerprintStatus({
  summary,
  variant = 'table',
  interactive = true,
  onOpen,
}: Props) {
  const { t } = useTranslation();
  const state = summary?.state ?? 'unknown';
  const counts = fingerprintModelCounts(summary?.snapshot);
  const tone =
    state === 'ready'
      ? styles.fingerprintToneHealthy
      : state === 'blocked'
        ? styles.fingerprintToneDanger
        : styles.fingerprintToneNeutral;
  const className = `${styles.fingerprintStatus} ${tone} ${variant === 'card' ? styles.fingerprintStatusCard : styles.fingerprintStatusTable}`;
  const content = (
    <>
      <span className={styles.fingerprintStatusMain}>
        <span className={styles.fingerprintStatusDot} aria-hidden="true" />
        <strong>
          {state === 'blocked' && counts.total > 0
            ? t('accounts.fingerprint_blocked_count', {
                count: counts.blocked,
                total: counts.total,
              })
            : t(`accounts.fingerprint_filter_${state}`)}
        </strong>
      </span>
      {summary?.snapshot?.running && !summary.snapshot.manually_disabled && state === 'blocked' && (
        <small>{t('accounts.fingerprint_rechecking')}</small>
      )}
      {state === 'blocked' && resolveFingerprintModels(summary?.snapshot).some((m) => m.wait) && (
        <small>{t('accounts.fingerprint_filter_waiting')}</small>
      )}
    </>
  );
  return interactive && onOpen ? (
    <button
      type="button"
      className={className}
      data-fingerprint-state={state}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      {content}
    </button>
  ) : (
    <span className={className} data-fingerprint-state={state}>
      {content}
    </span>
  );
}
