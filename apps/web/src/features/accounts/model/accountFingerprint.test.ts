import { describe, expect, it } from 'vitest';
import { resolveAccountFingerprint, accountFingerprintMatchesFilter } from './accountFingerprint';
import type { FingerprintSnapshot } from '@/types/fingerprint';
const summary = (s: Partial<FingerprintSnapshot>) =>
  resolveAccountFingerprint({
    name: 'synthetic.json',
    fingerprint_status: { enabled: true, manually_disabled: false, ...s },
  });
describe('fingerprint status', () => {
  it('distinguishes disabled, pending, errors and successful cycles', () => {
    expect(summary({ enabled: false }).state).toBe('unknown');
    expect(summary({}).state).toBe('missing');
    expect(summary({ running: true }).state).toBe('unclassified');
    expect(
      summary({
        results: [{ model: 'a', expected_model: 'a', status: 'insufficient', used_outputs: 0 }],
      }).state
    ).toBe('partial');
    expect(
      summary({ results: [{ model: 'a', expected_model: 'a', status: 'match', used_outputs: 3 }] })
        .state
    ).toBe('ready');
  });
  it('keeps cooldown visible after expiry, until backend retesting succeeds', () => {
    const s = summary({ blocked: true, running: true, cooldown_until: '2020-01-01T00:00:00Z' });
    expect(s.state).toBe('blocked');
    expect(accountFingerprintMatchesFilter(s, 'blocked')).toBe(true);
  });
  it('does not label partial recovery as successful', () => {
    expect(
      summary({
        effective: { models: ['a', 'b'] },
        results: [{ model: 'a', expected_model: 'a', status: 'match', used_outputs: 3 }],
      }).state
    ).toBe('partial');
    expect(summary({ configuration_error: 'state_invalid' }).state).toBe('blocked');
  });
});
