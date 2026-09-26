import { describe, expect, it } from 'vitest';
import { parseFingerprintPolicy, readCredentialPolicy } from './credentialPolicy';
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
});
