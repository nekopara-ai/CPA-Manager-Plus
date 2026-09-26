import { useTranslation } from 'react-i18next';
import type { AccountFingerprintSummary } from '../model/accountFingerprint';
import type { FingerprintResult } from '@/types/fingerprint';
import { AccountFingerprintStatus } from './AccountFingerprintStatus';
import styles from '../AccountsPage.module.scss';
export function FingerprintDetails({ summary }: { summary?: AccountFingerprintSummary }) {
  const { t } = useTranslation();
  const s = summary?.snapshot;
  const time = (v?: string) => (v && !v.startsWith('0001-') ? new Date(v).toLocaleString() : '—');
  const resultList = (results: FingerprintResult[]) =>
    results.map((r, i) => (
      <div key={`${r.model}-${i}`} className={styles.overviewFingerprintModel}>
        <strong>
          {r.model} → {r.prediction || '—'}
        </strong>
        <p>
          {t('accounts.fingerprint_expected')}: {r.expected_model} ·{' '}
          {t(`accounts.fingerprint_result_${r.status}`, { defaultValue: r.status })}
        </p>
        <p>
          {t('accounts.fingerprint_score')}:{' '}
          {typeof r.probability === 'number' ? `${(r.probability * 100).toFixed(2)}%` : '—'} ·{' '}
          {t('accounts.fingerprint_answers')}: {r.used_outputs}/3
        </p>
        <p>
          {time(r.finished_at)} {r.error ? `· ${r.error}` : ''}
        </p>
        {r.bank_version && (
          <small>
            {t('accounts.fingerprint_bank')}: {r.bank_version}
          </small>
        )}
      </div>
    ));
  return (
    <section className={styles.overviewCard} data-overview-section="fingerprint">
      <h3>{t('accounts.list_header_fingerprint')}</h3>
      <AccountFingerprintStatus summary={summary} provider="" interactive={false} />
      <p>{t('accounts.fingerprint_caveat')}</p>
      {s?.manually_disabled && <p>{t('accounts.fingerprint_manual_disabled')}</p>}
      {(s?.configuration_error || s?.error) && (
        <p role="alert">{s.configuration_error || s.error}</p>
      )}
      <dl className={styles.overviewFingerprintSummary}>
        <div>
          <dt>{t('accounts.fingerprint_last')}</dt>
          <dd>{time(s?.last_run_at)}</dd>
        </div>
        <div>
          <dt>{t('accounts.fingerprint_next')}</dt>
          <dd>{time(s?.next_run_at)}</dd>
        </div>
        <div>
          <dt>{t('accounts.fingerprint_cooldown_until')}</dt>
          <dd>{time(s?.cooldown_until)}</dd>
        </div>
        <div>
          <dt>{t('accounts.fingerprint_budget')}</dt>
          <dd>
            {s?.requests_today ?? 0} / {s?.effective?.['daily-request-limit'] ?? '—'}
          </dd>
        </div>
      </dl>
      {s?.trigger_model && (
        <p>
          {t('accounts.fingerprint_trigger')}: {s.trigger_model}
        </p>
      )}
      {resultList(s?.results ?? [])}
      {!!s?.history?.length && (
        <details>
          <summary>{t('accounts.fingerprint_history')}</summary>
          {s.history
            .slice()
            .reverse()
            .map((run, i) => (
              <div key={i}>
                <h4>{time(run.at)}</h4>
                {resultList(run.results ?? [])}
              </div>
            ))}
        </details>
      )}
      {s?.effective && (
        <details>
          <summary>{t('accounts.fingerprint_effective')}</summary>
          <pre>{JSON.stringify(s.effective, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}
