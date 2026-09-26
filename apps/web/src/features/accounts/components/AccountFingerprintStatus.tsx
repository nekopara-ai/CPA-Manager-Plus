import { useTranslation } from 'react-i18next';
import type { AccountFingerprintSummary } from '../model/accountFingerprint';
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
  const tone =
    state === 'ready'
      ? styles.fingerprintToneHealthy
      : state === 'blocked'
        ? styles.fingerprintToneDanger
        : styles.fingerprintToneNeutral;
  const className = `${styles.fingerprintStatus} ${tone} ${variant === 'card' ? styles.fingerprintStatusCard : styles.fingerprintStatusTable}`;
  const content = <strong>{t(`accounts.fingerprint_filter_${state}`)}</strong>;
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
