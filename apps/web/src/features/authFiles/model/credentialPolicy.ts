import type { FingerprintPolicy } from '@/types/fingerprint';
export interface CredentialPolicyDraft {
  timezoneMode?: 'inherit' | 'custom' | 'off';
  timezoneValue?: string;
  fingerprintText?: string;
}
export function readCredentialPolicy(record: Record<string, unknown>): CredentialPolicyDraft {
  const tz = record.timezone_override;
  return {
    timezoneMode: typeof tz !== 'string' ? 'inherit' : tz ? 'custom' : 'off',
    timezoneValue: typeof tz === 'string' ? tz : '',
    fingerprintText: record.fingerprint ? JSON.stringify(record.fingerprint, null, 2) : '',
  };
}
export function parseFingerprintPolicy(text: string): FingerprintPolicy | null {
  if (!text.trim()) return null;
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('object required');
  const p = value as Record<string, unknown>;
  const limits: Record<string, [number, number]> = {
    'interval-seconds': [60, 2592000],
    'cooldown-seconds': [1, 2592000],
    'retry-seconds': [10, 86400],
    'max-retry-seconds': [10, 2592000],
    'minimum-answers': [1, 3],
    'question-retries': [0, 2],
    'daily-request-limit': [3, 100000],
    'history-limit': [1, 100],
  };
  for (const [key, [min, max]] of Object.entries(limits)) {
    const v = p[key];
    if (
      v !== undefined &&
      v !== null &&
      (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max)
    )
      throw new Error(key);
  }
  for (const key of ['enabled', 'retain-answers'])
    if (p[key] != null && typeof p[key] !== 'boolean') throw new Error(key);
  if (
    p.confidence != null &&
    (typeof p.confidence !== 'number' ||
      !Number.isFinite(p.confidence) ||
      p.confidence < 0.5 ||
      p.confidence > 1)
  )
    throw new Error('confidence');
  if (
    p.models != null &&
    (!Array.isArray(p.models) ||
      !p.models.length ||
      p.models.length > 32 ||
      p.models.some((m) => typeof m !== 'string' || !m.trim()) ||
      new Set(p.models).size !== p.models.length)
  )
    throw new Error('models');
  if (
    p['expected-models'] != null &&
    (typeof p['expected-models'] !== 'object' ||
      Array.isArray(p['expected-models']) ||
      Object.values(p['expected-models']).some((v) => typeof v !== 'string' || !v.trim()))
  )
    throw new Error('expected-models');
  return p as FingerprintPolicy;
}
