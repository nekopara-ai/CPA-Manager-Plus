import type { AuthFileItem } from '@/types';
import type { FingerprintSnapshot } from '@/types/fingerprint';
export const ACCOUNT_FINGERPRINT_FILTERS = [
  'all',
  'ready',
  'partial',
  'missing',
  'unclassified',
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
export function resolveAccountFingerprint(
  file: AuthFileItem,
  _provider?: string
): AccountFingerprintSummary {
  const snapshot = file.fingerprint_status;
  if (snapshot?.supported === false) return { state: 'unsupported', snapshot };
  if (snapshot?.manually_disabled || file.disabled) return { state: 'disabled', snapshot };
  if (!snapshot || !snapshot.enabled) return { state: 'unknown', snapshot };
  if (snapshot.blocked || snapshot.configuration_error) return { state: 'blocked', snapshot };
  if (snapshot.running) return { state: 'unclassified', snapshot };
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
