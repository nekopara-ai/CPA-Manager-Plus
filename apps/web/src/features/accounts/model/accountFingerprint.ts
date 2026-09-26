import type { AuthFileItem } from '@/types';
import type { FingerprintResult, FingerprintSnapshot, FingerprintWait } from '@/types/fingerprint';
export const ACCOUNT_FINGERPRINT_FILTERS = [
  'all',
  'ready',
  'partial',
  'missing',
  'unclassified',
  'waiting',
  'blocked',
  'unknown',
  'stale',
  'unsupported',
  'disabled',
] as const;
export type AccountFingerprintFilter = (typeof ACCOUNT_FINGERPRINT_FILTERS)[number];
export interface AccountFingerprintSummary {
  state: Exclude<AccountFingerprintFilter, 'all'>;
  snapshot?: FingerprintSnapshot;
}

export interface FingerprintModelView {
  model: string;
  gate: 'blocked' | 'allowed' | 'disabled' | 'off' | 'unsupported';
  result?: FingerprintResult;
  threshold?: number;
  stale: boolean;
  running: boolean;
  cooldownUntil?: string;
  nextRunAt?: string;
  wait?: FingerprintWait;
}

/** Eligibility and classifier verdict are separate: an untested model can be allowed. */
export function resolveFingerprintModels(s?: FingerprintSnapshot): FingerprintModelView[] {
  if (!s) return [];
  const names = s.effective?.models ?? [
    ...Object.keys(s.model_states ?? {}),
    ...(s.results ?? []).map((r) => r.model),
    ...(s.current_results ?? []).map((r) => r.model),
  ];
  const modelKey = (model: string) =>
    model
      .trim()
      .replace(/\([^()]*\)$/, '')
      .toLowerCase();
  return [...new Set(names)].map((model) => {
    const state = s.model_states?.[model];
    const current = s.current_results?.find((r) => r.model === model && r.status !== 'deferred');
    const result = current ?? state?.result ?? s.results?.find((r) => r.model === model);
    // Older backends expose only an account-wide exclusion; do not invent a partial recovery.
    const blocked =
      !!s.configuration_error ||
      (s.model_states
        ? names.some(
            (name) => modelKey(name) === modelKey(model) && s.model_states?.[name]?.blocked
          )
        : !!s.blocked);
    const gate = s.manually_disabled
      ? 'disabled'
      : s.supported === false
        ? 'unsupported'
        : !s.enabled
          ? 'off'
          : blocked
            ? 'blocked'
            : 'allowed';
    return {
      model,
      gate,
      result,
      threshold: result?.confidence ?? (current ? undefined : state?.result_policy?.confidence),
      stale: current ? false : (state?.results_stale ?? !!s.results_stale),
      running: !!s.enabled && !s.manually_disabled && !!s.running && s.progress?.model === model,
      cooldownUntil: gate === 'blocked' ? (state?.cooldown_until ?? s.cooldown_until) : undefined,
      nextRunAt: state?.next_run_at ?? s.next_run_at,
      wait: s.enabled && !s.manually_disabled && s.supported !== false ? state?.wait : undefined,
    };
  });
}

export function fingerprintModelCounts(s?: FingerprintSnapshot) {
  const models = resolveFingerprintModels(s);
  return { total: models.length, blocked: models.filter((m) => m.gate === 'blocked').length };
}
export function resolveAccountFingerprint(
  file: AuthFileItem,
  _provider?: string
): AccountFingerprintSummary {
  const snapshot =
    file.disabled && file.fingerprint_status
      ? { ...file.fingerprint_status, manually_disabled: true }
      : file.fingerprint_status;
  if (snapshot?.manually_disabled || file.disabled) return { state: 'disabled', snapshot };
  if (snapshot?.supported === false) return { state: 'unsupported', snapshot };
  if (!snapshot || !snapshot.enabled) return { state: 'unknown', snapshot };
  if (snapshot.blocked || snapshot.configuration_error || fingerprintModelCounts(snapshot).blocked)
    return { state: 'blocked', snapshot };
  if (snapshot.running) return { state: 'unclassified', snapshot };
  if (resolveFingerprintModels(snapshot).some((m) => m.wait)) return { state: 'waiting', snapshot };
  if (snapshot.results_stale) return { state: 'stale', snapshot };
  const results = snapshot.results ?? [];
  if (!results.length) return { state: 'missing', snapshot };
  const complete = results.length === (snapshot.effective?.models?.length ?? results.length);
  if (complete && results.every((r) => r.status === 'match')) return { state: 'ready', snapshot };
  return { state: 'partial', snapshot };
}
export const isAccountFingerprintReady = (summary?: AccountFingerprintSummary) =>
  summary?.state === 'ready';
export const accountFingerprintMatchesFilter = (
  summary?: AccountFingerprintSummary,
  filter: AccountFingerprintFilter = 'all'
) => filter === 'all' || (summary?.state ?? 'unknown') === filter;
