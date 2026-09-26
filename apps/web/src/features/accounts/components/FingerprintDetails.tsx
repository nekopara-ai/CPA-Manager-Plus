import { useTranslation } from 'react-i18next';
import type { AccountFingerprintSummary } from '../model/accountFingerprint';
import type { FingerprintResult } from '@/types/fingerprint';
import { AccountFingerprintStatus } from './AccountFingerprintStatus';
import styles from '../AccountsPage.module.scss';
export function FingerprintDetails({ summary }: { summary?: AccountFingerprintSummary }) {
  const { t } = useTranslation();
  const s = summary?.snapshot;
  const time = (v?: string) => (v && !v.startsWith('0001-') ? new Date(v).toLocaleString() : '—');
  const percent = (v?: number) => (typeof v === 'number' ? `${(v * 100).toFixed(2)}%` : '—');
  const resultList = (results: FingerprintResult[], threshold?: number) =>
    results.map((r, i) => (
      <div key={`${r.model}-${i}`} className={styles.overviewFingerprintModel}>
        <strong>
          {r.model} → {r.prediction || '—'}
        </strong>
        <p>
          {t('accounts.fingerprint_result_threshold')}:{' '}
          {typeof (r.confidence ?? threshold) === 'number'
            ? percent(r.confidence ?? threshold)
            : t('accounts.fingerprint_threshold_unknown')}
        </p>
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
      <p>{t('accounts.fingerprint_model_scope')}</p>
      {s?.manually_disabled && <p>{t('accounts.fingerprint_manual_disabled')}</p>}
      {s?.supported === false && <p>{t('accounts.fingerprint_unsupported_hint')}</p>}
      {s?.results_stale && <p role="status">{t('accounts.fingerprint_stale_hint')}</p>}
      {(s?.configuration_error || s?.error) && (
        <p role="alert">{s.configuration_error || s.error}</p>
      )}
      <dl className={styles.overviewFingerprintSummary}>
        <div>
          <dt>{t('accounts.fingerprint_current_threshold')}</dt>
          <dd>{percent(s?.effective?.confidence)}</dd>
        </div>
        <div>
          <dt>{t('accounts.fingerprint_last')}</dt>
          <dd>{time(s?.last_run_at)}</dd>
        </div>
        <div>
          <dt>{t('accounts.fingerprint_next')}</dt>
          <dd>{s?.running ? t('accounts.fingerprint_next_after_run') : time(s?.next_run_at)}</dd>
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
      {!!s?.model_states && (
        <div data-fingerprint-model-states>
          {Object.entries(s.model_states).map(([model, state]) => (
            <div key={model}>
              <strong>
                {model} ·{' '}
                {t(
                  s.enabled && !s.manually_disabled && state.blocked
                    ? 'accounts.fingerprint_model_blocked'
                    : 'accounts.fingerprint_model_allowed'
                )}
              </strong>
              {s.enabled && state.blocked && (
                <p>
                  {t('accounts.fingerprint_cooldown_until')}: {time(state.cooldown_until)}
                </p>
              )}
              <p>
                {t('accounts.fingerprint_next')}:{' '}
                {s.running && s.progress?.model === model
                  ? t('accounts.fingerprint_filter_unclassified')
                  : time(state.next_run_at)}
              </p>
              {state.results_stale && <p>{t('accounts.fingerprint_stale_hint')}</p>}
            </div>
          ))}
        </div>
      )}
      {s?.running && s.progress && (
        <div data-fingerprint-progress>
          <h4>{t('accounts.fingerprint_progress')}</h4>
          <p>
            {s.progress.model} · {t('accounts.fingerprint_question')}: {s.progress.question}/3 ·{' '}
            {t('accounts.fingerprint_attempt')}: {s.progress.attempt}
          </p>
          <p>
            {t('accounts.fingerprint_completed_questions')}: {s.progress.completed_questions}/
            {s.progress.total_questions}
          </p>
          <p>
            {t('accounts.fingerprint_started')}: {time(s.progress.started_at)}
          </p>
          <p>
            {t('accounts.fingerprint_request_started')}: {time(s.progress.request_started_at)}
          </p>
          <p>
            {t('accounts.fingerprint_last_event')}: {time(s.progress.last_event_at)} ·{' '}
            {t('accounts.fingerprint_received_bytes')}: {s.progress.received_bytes}
          </p>
          {resultList(s.current_results ?? [])}
        </div>
      )}
      {s?.trigger_model && (
        <p>
          {t('accounts.fingerprint_trigger')}: {s.trigger_model}
        </p>
      )}
      {!!s?.results?.length && <h4>{t('accounts.fingerprint_last_completed')}</h4>}
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
                {resultList(run.results ?? [], run.policy?.confidence)}
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
