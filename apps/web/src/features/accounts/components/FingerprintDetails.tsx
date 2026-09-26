import { useTranslation } from 'react-i18next';
import type { FingerprintResult } from '@/types/fingerprint';
import {
  resolveFingerprintModels,
  type AccountFingerprintSummary,
} from '../model/accountFingerprint';
import { AccountFingerprintStatus } from './AccountFingerprintStatus';
import styles from './FingerprintDetails.module.scss';

const percent = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) ? `${(value * 100).toFixed(2)}%` : '—';

export function FingerprintDetails({ summary }: { summary?: AccountFingerprintSummary }) {
  const { t, i18n } = useTranslation();
  const s = summary?.snapshot;
  const models = resolveFingerprintModels(s);
  const active = !!s?.enabled && !s.manually_disabled && s.supported !== false;
  const progress = active && s?.running ? s.progress : undefined;
  const time = (value?: string) => {
    if (!value || value.startsWith('0001-') || !Number.isFinite(Date.parse(value))) return '—';
    return new Date(value).toLocaleString(i18n?.language, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };
  const duration = (seconds?: number) => {
    if (seconds === undefined) return '—';
    if (seconds % 3600 === 0) return t('accounts.fingerprint_hours', { count: seconds / 3600 });
    if (seconds % 60 === 0) return t('accounts.fingerprint_minutes', { count: seconds / 60 });
    return t('accounts.fingerprint_seconds', { count: seconds });
  };
  const verdict = (r?: FingerprintResult) =>
    t(r ? `accounts.fingerprint_result_${r.status}` : 'accounts.fingerprint_filter_missing', {
      defaultValue: r?.status,
    });
  const gateLabel = (gate: string) => t(`accounts.fingerprint_gate_${gate}`);
  const threshold = (value?: number) =>
    value === undefined ? t('accounts.fingerprint_threshold_unknown') : percent(value);
  return (
    <section className={styles.root} data-overview-section="fingerprint">
      <header className={styles.header}>
        <div>
          <h3>{t('accounts.list_header_fingerprint')}</h3>
          <p>{t('accounts.fingerprint_scope_short')}</p>
        </div>
        <AccountFingerprintStatus
          summary={summary}
          provider=""
          variant="card"
          interactive={false}
        />
      </header>
      <dl className={styles.metrics}>
        <div>
          <dt>{t('accounts.fingerprint_current_threshold')}</dt>
          <dd>{percent(s?.effective?.confidence)}</dd>
        </div>
        <div>
          <dt>{t('accounts.fingerprint_interval_short')}</dt>
          <dd>{duration(s?.effective?.['interval-seconds'])}</dd>
        </div>
        <div>
          <dt>{t('accounts.fingerprint_cooldown_short')}</dt>
          <dd>{duration(s?.effective?.['cooldown-seconds'])}</dd>
        </div>
        <div>
          <dt>{t('accounts.fingerprint_budget')}</dt>
          <dd>
            {s?.requests_today ?? 0}
            <span> / {s?.effective?.['daily-request-limit'] ?? '—'}</span>
          </dd>
        </div>
      </dl>
      {s?.manually_disabled ? (
        <p className={styles.notice}>{t('accounts.fingerprint_manual_disabled')}</p>
      ) : s?.supported === false ? (
        <p className={styles.notice}>{t('accounts.fingerprint_unsupported_hint')}</p>
      ) : !s?.enabled ? (
        <p className={styles.notice}>{t('accounts.fingerprint_off_hint')}</p>
      ) : null}
      {(s?.configuration_error || s?.error) && (
        <div className={styles.alert} role="alert">
          <strong>
            {t(
              !active
                ? 'accounts.fingerprint_inactive_error_hint'
                : s.configuration_error
                  ? 'accounts.fingerprint_config_error_hint'
                  : 'accounts.fingerprint_error_hint'
            )}
          </strong>
          <code>{s.configuration_error || s.error}</code>
        </div>
      )}
      {s?.results_stale && (
        <p className={styles.notice} role="status">
          {t('accounts.fingerprint_stale_hint')}
        </p>
      )}
      {progress && (
        <div className={styles.progress} data-fingerprint-progress>
          <div className={styles.progressHeading}>
            <strong>{t('accounts.fingerprint_progress')}</strong>
            <span>
              {t('accounts.fingerprint_completed_questions')} {progress.completed_questions}/
              {progress.total_questions}
            </span>
          </div>
          <progress
            aria-label={t('accounts.fingerprint_progress')}
            max={Math.max(1, progress.total_questions)}
            value={Math.min(progress.completed_questions, progress.total_questions)}
          />
          <div className={styles.progressMeta}>
            <span>
              <b>{progress.model || '—'}</b> · {t('accounts.fingerprint_question')}{' '}
              {progress.question}/3 · {t('accounts.fingerprint_attempt')} {progress.attempt}
            </span>
            <span>
              {t('accounts.fingerprint_last_event')} {time(progress.last_event_at)} ·{' '}
              {progress.received_bytes.toLocaleString()} B
            </span>
          </div>
          <details className={styles.transportDetails}>
            <summary>{t('accounts.fingerprint_transport_details')}</summary>
            <span>
              {t('accounts.fingerprint_started')}: {time(progress.started_at)} ·{' '}
              {t('accounts.fingerprint_request_started')}: {time(progress.request_started_at)}
            </span>
          </details>
        </div>
      )}
      <div className={styles.models} data-fingerprint-model-states>
        {models.map((m) => (
          <article key={m.model} className={styles.model} data-model={m.model} data-gate={m.gate}>
            <header className={styles.modelHeader}>
              <h4 title={m.model}>{m.model}</h4>
              <span className={styles.gate} data-gate={m.gate}>
                {gateLabel(m.gate)}
              </span>
            </header>
            {m.wait && (
              <div className={styles.notice} role="status" data-fingerprint-wait>
                <strong>
                  {t(
                    m.wait.reason === 'quota'
                      ? 'accounts.fingerprint_wait_quota'
                      : 'accounts.fingerprint_wait_unavailable'
                  )}
                </strong>
                <div>{t('accounts.fingerprint_wait_preserved')}</div>
                <div>
                  {t('accounts.fingerprint_wait_retry')}: {time(m.wait.retry_at)}
                </div>
              </div>
            )}
            <div className={styles.resultHeading}>
              <div>
                <span className={styles.label}>{t('accounts.fingerprint_score')}</span>
                <strong className={styles.score}>{percent(m.result?.probability)}</strong>
              </div>
              <div className={styles.verdict} data-verdict={m.stale ? 'stale' : m.result?.status}>
                <strong>{verdict(m.result)}</strong>
                <span>
                  {t('accounts.fingerprint_answers')} {m.result?.used_outputs ?? 0}/3
                </span>
              </div>
            </div>
            <dl className={styles.modelFields}>
              <div>
                <dt>{t('accounts.fingerprint_prediction')}</dt>
                <dd>{m.result?.prediction || '—'}</dd>
              </div>
              <div>
                <dt>{t('accounts.fingerprint_expected')}</dt>
                <dd>
                  {m.result?.expected_model ||
                    s?.effective?.['expected-models']?.[m.model] ||
                    m.model}
                </dd>
              </div>
              <div className={styles.wide}>
                <dt>{t('accounts.fingerprint_result_threshold')}</dt>
                <dd>{threshold(m.threshold)}</dd>
              </div>
            </dl>
            {m.stale && !s?.results_stale && (
              <p className={styles.modelNote}>{t('accounts.fingerprint_filter_stale')}</p>
            )}
            {m.result?.error && <code className={styles.errorCode}>{m.result.error}</code>}
            <footer className={styles.modelFooter}>
              {m.gate === 'blocked' && m.cooldownUntil && !m.cooldownUntil.startsWith('0001-') && (
                <div className={styles.cooldown}>
                  <span>{t('accounts.fingerprint_cooldown_until')}</span>
                  <time dateTime={m.cooldownUntil}>{time(m.cooldownUntil)}</time>
                </div>
              )}
              <div>
                <span>{t('accounts.fingerprint_last')}</span>
                <time dateTime={m.result?.finished_at}>{time(m.result?.finished_at)}</time>
              </div>
              <div>
                <span>{t('accounts.fingerprint_next')}</span>
                <span>
                  {!active
                    ? '—'
                    : m.running
                      ? t('accounts.fingerprint_rechecking')
                      : time(m.nextRunAt)}
                </span>
              </div>
            </footer>
            {m.result?.bank_version && (
              <details className={styles.transportDetails}>
                <summary>{t('accounts.fingerprint_bank')}</summary>
                <code>{m.result.bank_version}</code>
              </details>
            )}
          </article>
        ))}
      </div>
      {!models.length && <div className={styles.empty}>{t('accounts.fingerprint_empty_hint')}</div>}
      <div className={styles.schedule}>
        <span>
          {t('accounts.fingerprint_last')}: {time(s?.last_run_at)}
        </span>
        <span>
          {t('accounts.fingerprint_next')}:{' '}
          {!active
            ? '—'
            : s?.running
              ? t('accounts.fingerprint_next_after_run')
              : time(s?.next_run_at)}
        </span>
      </div>
      {!!s?.history?.length && (
        <details className={styles.disclosure} data-fingerprint-history>
          <summary>
            {t('accounts.fingerprint_history')}
            <span>{s.history.length}</span>
          </summary>
          <div className={styles.history}>
            {s.history
              .slice()
              .reverse()
              .map((run, i) => (
                <div key={`${run.at}-${i}`} className={styles.historyRun}>
                  <time dateTime={run.at}>{time(run.at)}</time>
                  {(run.results ?? []).map((r, j) => (
                    <div key={`${r.model}-${j}`} className={styles.historyResult}>
                      <div>
                        <strong>{r.model}</strong>
                        <span>{verdict(r)}</span>
                      </div>
                      <div>
                        <span>
                          {t('accounts.fingerprint_prediction')}: {r.prediction || '—'}
                        </span>
                        <strong>{percent(r.probability)}</strong>
                      </div>
                      <small>
                        {t('accounts.fingerprint_result_threshold')}:{' '}
                        {threshold(r.confidence ?? run.policy?.confidence)} ·{' '}
                        {t('accounts.fingerprint_answers')} {r.used_outputs}/3
                      </small>
                      {r.error && <code className={styles.errorCode}>{r.error}</code>}
                      {r.deferred && (
                        <small>
                          {t(
                            r.deferred.reason === 'quota'
                              ? 'accounts.fingerprint_wait_quota'
                              : 'accounts.fingerprint_wait_unavailable'
                          )}
                          {' · '}
                          {t('accounts.fingerprint_wait_retry')}: {time(r.deferred.retry_at)}
                        </small>
                      )}
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </details>
      )}
      {s?.effective && (
        <details className={styles.disclosure}>
          <summary>{t('accounts.fingerprint_effective')}</summary>
          <pre>{JSON.stringify(s.effective, null, 2)}</pre>
        </details>
      )}
      <details className={styles.disclosure}>
        <summary>{t('accounts.fingerprint_method_notes')}</summary>
        <p>{t('accounts.fingerprint_model_scope')}</p>
        <p>{t('accounts.fingerprint_caveat')}</p>
      </details>
    </section>
  );
}
