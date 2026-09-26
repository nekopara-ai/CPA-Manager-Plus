import type { FingerprintPolicy } from '@/types/fingerprint';
export interface CredentialPolicyDraft {
  timezoneMode?: 'inherit' | 'custom' | 'off';
  timezoneValue?: string;
  timezoneCountryMode?: 'inherit' | 'custom' | 'off';
  timezoneCountryValue?: string;
  timezoneRegionMode?: 'inherit' | 'custom' | 'off';
  timezoneRegionValue?: string;
  timezoneCityMode?: 'inherit' | 'custom' | 'off';
  timezoneCityValue?: string;
  fingerprintText?: string;
  fingerprintModelsInput?: string;
  fingerprintExpectedInput?: string;
  fingerprintNumberInputs?: Record<string, string>;
}
export const LOCATION_FIELDS = [
  {
    key: 'timezone_override_country',
    mode: 'timezoneCountryMode',
    value: 'timezoneCountryValue',
    label: 'country',
    example: 'JP',
  },
  {
    key: 'timezone_override_region',
    mode: 'timezoneRegionMode',
    value: 'timezoneRegionValue',
    label: 'region',
    example: 'Tokyo',
  },
  {
    key: 'timezone_override_city',
    mode: 'timezoneCityMode',
    value: 'timezoneCityValue',
    label: 'city',
    example: 'Shinjuku',
  },
] as const;
export function readCredentialPolicy(record: Record<string, unknown>): CredentialPolicyDraft {
  const tz = record.timezone_override;
  const draft: CredentialPolicyDraft = {
    timezoneMode: typeof tz !== 'string' ? 'inherit' : tz ? 'custom' : 'off',
    timezoneValue: typeof tz === 'string' ? tz : '',
    fingerprintText: record.fingerprint ? JSON.stringify(record.fingerprint, null, 2) : '',
  };
  for (const field of LOCATION_FIELDS) {
    const value = record[field.key];
    draft[field.mode] = typeof value !== 'string' ? 'inherit' : value ? 'custom' : 'off';
    draft[field.value] = typeof value === 'string' ? value : '';
  }
  return draft;
}
export const FINGERPRINT_NUMBERS = [
  { key: 'interval-seconds', min: 60, max: 2592000, step: 1, default: 3600 },
  { key: 'cooldown-seconds', min: 1, max: 2592000, step: 1, default: 1800 },
  { key: 'confidence', min: 0.5, max: 1, step: 0.01, default: 0.95 },
  { key: 'minimum-answers', min: 1, max: 3, step: 1, default: 3 },
  { key: 'question-retries', min: 0, max: 2, step: 1, default: 1 },
  { key: 'retry-seconds', min: 10, max: 86400, step: 1, default: 300 },
  { key: 'max-retry-seconds', min: 10, max: 2592000, step: 1, default: 3600 },
  { key: 'daily-request-limit', min: 3, max: 100000, step: 1, default: 300 },
  { key: 'history-limit', min: 1, max: 100, step: 1, default: 10 },
] as const;

// Keep JSON as one source of truth for both visual controls and the optional
// advanced editor. Unknown fields survive edits; invalid JSON must not be reset.
export function fingerprintObject(text: string): Record<string, unknown> {
  const value: unknown = text.trim() ? JSON.parse(text) : {};
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('object required');
  return value as Record<string, unknown>;
}
export function editFingerprintField(
  text: string,
  key: keyof FingerprintPolicy,
  value: unknown
): string {
  const object = fingerprintObject(text);
  if (value === undefined) delete object[key];
  else object[key] = value;
  return Object.keys(object).length ? JSON.stringify(object, null, 2) : '';
}
export function parseExpectedModels(text: string): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const line of text.split('\n').filter((line) => line.trim())) {
    const parts = line.split('=');
    if (parts.length !== 2 || parts.some((p) => !p.trim())) throw new Error('expected-models');
    const [key, value] = parts.map((p) => p.trim());
    if (Object.prototype.hasOwnProperty.call(result, key))
      throw new Error('duplicate requested model');
    result[key] = value;
  }
  return result;
}
export function parseFingerprintPolicy(text: string): FingerprintPolicy | null {
  if (!text.trim()) return null;
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('object required');
  const p = value as Record<string, unknown>;
  for (const { key, min, max } of FINGERPRINT_NUMBERS.filter((f) => f.key !== 'confidence')) {
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
      p.models.some((m) => typeof m !== 'string' || !m.trim() || /[\r\n\0]/.test(m)) ||
      new Set(p.models).size !== p.models.length)
  )
    throw new Error('models');
  if (
    p['expected-models'] != null &&
    (typeof p['expected-models'] !== 'object' ||
      Array.isArray(p['expected-models']) ||
      Object.keys(p['expected-models']).some((k) => !k.trim()) ||
      Object.values(p['expected-models']).some((v) => typeof v !== 'string' || !v.trim()))
  )
    throw new Error('expected-models');
  return p as FingerprintPolicy;
}
