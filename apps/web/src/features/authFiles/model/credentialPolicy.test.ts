import { describe, expect, it } from 'vitest';
import {
  editFingerprintField,
  fingerprintObject,
  FINGERPRINT_NUMBERS,
  LOCATION_FIELDS,
  parseExpectedModels,
  parseFingerprintPolicy,
  readCredentialPolicy,
} from './credentialPolicy';
import { applyAuthFileFieldsPatchToRecord } from '@/services/api/authFiles';
import {
  buildAuthFileConfigurationDraft,
  buildAuthFileConfigurationPatch,
} from './authFileConfiguration';

describe('credential policy', () => {
  it('distinguishes inherited, off and custom timezone', () => {
    expect(readCredentialPolicy({}).timezoneMode).toBe('inherit');
    expect(readCredentialPolicy({ timezone_override: '' }).timezoneMode).toBe('off');
    expect(readCredentialPolicy({ timezone_override: 'Asia/Tokyo' }).timezoneMode).toBe('custom');
  });
  it('validates policy and preserves unrecognized fields for forward compatibility', () => {
    expect(parseFingerprintPolicy('')).toBeNull();
    expect(parseFingerprintPolicy('{"enabled":false,"cooldown-seconds":120,"future":7}')).toEqual({
      enabled: false,
      'cooldown-seconds': 120,
      future: 7,
    });
    for (const text of [
      '[]',
      'null',
      '{"models":[]}',
      '{"models":["x","x"]}',
      '{"confidence":0}',
      '{"interval-seconds":0}',
      '{"enabled":"true"}',
      '{"expected-models":[]}',
    ])
      expect(() => parseFingerprintPolicy(text)).toThrow();
  });
  it('only patches changed policy fields and uses null to inherit', () => {
    const record = {
      timezone_override: 'Asia/Tokyo',
      fingerprint: { enabled: true, 'cooldown-seconds': 120 },
    };
    const draft = buildAuthFileConfigurationDraft(record, 'codex');
    const unchanged = buildAuthFileConfigurationPatch(record, 'codex', draft, draft);
    expect(unchanged.patch.timezone_override).toBeUndefined();
    expect(unchanged.patch.fingerprint).toBeUndefined();
    const changed = buildAuthFileConfigurationPatch(record, 'codex', draft, {
      ...draft,
      timezoneMode: 'inherit',
      fingerprintText: '',
    });
    expect(changed.patch).toMatchObject({ timezone_override: null, fingerprint: null });
  });

  it.each(LOCATION_FIELDS)(
    'reads and patches all modes for $key without changing other fields',
    (field) => {
      expect(readCredentialPolicy({})[field.mode]).toBe('inherit');
      expect(readCredentialPolicy({ [field.key]: '' })[field.mode]).toBe('off');
      const record = { [field.key]: 'existing', note: 'keep', proxy_url: 'http://proxy.test' };
      const original = buildAuthFileConfigurationDraft(record, 'codex');
      expect(original[field.mode]).toBe('custom');
      expect(original[field.value]).toBe('existing');
      for (const [mode, expected] of [
        ['inherit', null],
        ['off', ''],
        ['custom', field.example],
      ] as const) {
        const result = buildAuthFileConfigurationPatch(record, 'codex', original, {
          ...original,
          [field.mode]: mode,
          [field.value]: ` ${field.example} `,
        });
        expect(result.errors).toEqual({});
        expect(result.patch).toEqual({ [field.key]: expected });
        const saved = applyAuthFileFieldsPatchToRecord(record, result.patch);
        expect(saved.note).toBe('keep');
        expect(saved.proxy_url).toBe('http://proxy.test');
        expect(saved[field.key]).toBe(expected === null ? undefined : expected);
        expect(readCredentialPolicy(saved)[field.mode]).toBe(mode);
        expect(record[field.key]).toBe('existing');
      }
    }
  );

  it.each(LOCATION_FIELDS)('rejects blank and multiline custom values for $key', (field) => {
    const original = buildAuthFileConfigurationDraft({}, 'codex');
    for (const value of ['', ' ', 'city\nother', 'city\0other', 'city\rother']) {
      const result = buildAuthFileConfigurationPatch({}, 'codex', original, {
        ...original,
        [field.mode]: 'custom',
        [field.value]: value,
      });
      expect(result.errors[field.value]).toBe('accounts.config_error_location');
      expect(result.patch[field.key]).toBeUndefined();
    }
  });

  it.each(FINGERPRINT_NUMBERS)('validates boundaries, types and inheritance for $key', (field) => {
    for (const value of [field.min, field.max, field.default, null]) {
      expect(parseFingerprintPolicy(JSON.stringify({ [field.key]: value }))).toEqual({
        [field.key]: value,
      });
    }
    for (const value of [field.min - 1, field.max + 1, true, '1', {}, []]) {
      expect(() => parseFingerprintPolicy(JSON.stringify({ [field.key]: value }))).toThrow(
        field.key
      );
    }
    if (field.key !== 'confidence') {
      expect(() =>
        parseFingerprintPolicy(JSON.stringify({ [field.key]: field.min + 0.5 }))
      ).toThrow(field.key);
    }
  });

  it('round trips timezone, geography and every fingerprint field including explicit false and zero', () => {
    const fingerprint = {
      enabled: false,
      'retain-answers': false,
      models: ['gpt-6-sol', 'gpt-6-astra'],
      'expected-models': { 'gpt-6-sol': 'gpt-6-sol' },
      ...Object.fromEntries(FINGERPRINT_NUMBERS.map(({ key, default: value }) => [key, value])),
      'question-retries': 0,
    };
    const record = {
      timezone_override: 'Europe/London',
      fingerprint: { enabled: true },
      unrelated: 'keep',
    };
    const original = buildAuthFileConfigurationDraft(record, 'codex');
    const result = buildAuthFileConfigurationPatch(record, 'codex', original, {
      ...original,
      timezoneMode: 'off',
      timezoneCountryMode: 'custom',
      timezoneCountryValue: 'JP',
      timezoneRegionMode: 'custom',
      timezoneRegionValue: 'Tokyo',
      timezoneCityMode: 'off',
      fingerprintText: JSON.stringify(fingerprint),
    });
    expect(result.errors).toEqual({});
    expect(result.patch).toEqual({
      timezone_override: '',
      timezone_override_country: 'JP',
      timezone_override_region: 'Tokyo',
      timezone_override_city: '',
      fingerprint,
    });
    const saved = applyAuthFileFieldsPatchToRecord(record, result.patch);
    expect(saved).toEqual({ ...result.patch, unrelated: 'keep' });
    const reopened = buildAuthFileConfigurationDraft(saved, 'codex');
    expect(parseFingerprintPolicy(reopened.fingerprintText || '')).toEqual(fingerprint);
    expect(buildAuthFileConfigurationPatch(saved, 'codex', reopened, reopened).patch).toEqual({});
    const inherited = applyAuthFileFieldsPatchToRecord(saved, {
      timezone_override: null,
      timezone_override_country: null,
      timezone_override_region: null,
      timezone_override_city: null,
      fingerprint: null,
    });
    expect(inherited).toEqual({ unrelated: 'keep' });
    expect(record.fingerprint).toEqual({ enabled: true });
    expect(applyAuthFileFieldsPatchToRecord(saved, { fingerprint: undefined })).toEqual(saved);
  });

  it('keeps visual edits and JSON in sync without dropping unknown fields', () => {
    const original = '{"future":{"keep":true},"enabled":true}';
    const edited = editFingerprintField(original, 'question-retries', 0);
    expect(fingerprintObject(edited)).toEqual({
      future: { keep: true },
      enabled: true,
      'question-retries': 0,
    });
    expect(fingerprintObject(editFingerprintField(edited, 'enabled', undefined))).toEqual({
      future: { keep: true },
      'question-retries': 0,
    });
    expect(editFingerprintField('{"enabled":false}', 'enabled', undefined)).toBe('');
    for (const invalid of ['[1]', 'null', '42', '{']) {
      expect(() => editFingerprintField(invalid, 'enabled', true)).toThrow();
    }
  });

  it('parses explicit expected-model mappings and rejects ambiguous or incomplete lines', () => {
    expect(parseExpectedModels('gpt-6 = gpt-6-astra\n\ngpt-6-thinking = gpt-6-sol\n')).toEqual({
      'gpt-6': 'gpt-6-astra',
      'gpt-6-thinking': 'gpt-6-sol',
    });
    expect(parseExpectedModels('')).toEqual({});
    expect(parseExpectedModels('__proto__ = label')).toHaveProperty('__proto__', 'label');
    for (const invalid of ['a', 'a =', '= label', 'a=b=c', 'a=b\na=c']) {
      expect(() => parseExpectedModels(invalid)).toThrow();
    }
    for (const models of [
      ['x', 'x'],
      [''],
      ['a\nb'],
      ['a\0b'],
      ['a\rb'],
      Array.from({ length: 33 }, (_, i) => `model-${i}`),
    ]) {
      expect(() => parseFingerprintPolicy(JSON.stringify({ models }))).toThrow('models');
    }
    expect(() => parseFingerprintPolicy('{"expected-models":{"":"a"}}')).toThrow('expected-models');
  });

  it('ignores JSON formatting changes and permits repair of invalid existing policies', () => {
    const record = { fingerprint: { enabled: true } };
    const original = buildAuthFileConfigurationDraft(record, 'codex');
    expect(
      buildAuthFileConfigurationPatch(record, 'codex', original, {
        ...original,
        fingerprintText: '{ "enabled":true }',
      }).patch
    ).toEqual({});
    const invalid = { ...original, fingerprintText: '{' };
    expect(
      buildAuthFileConfigurationPatch(record, 'codex', invalid, {
        ...invalid,
        fingerprintText: '{"enabled":false}',
      })
    ).toMatchObject({ errors: {}, patch: { fingerprint: { enabled: false } } });
    expect(
      buildAuthFileConfigurationPatch(record, 'codex', original, invalid).errors.fingerprintText
    ).toBe('accounts.config_error_fingerprint');
  });
});
