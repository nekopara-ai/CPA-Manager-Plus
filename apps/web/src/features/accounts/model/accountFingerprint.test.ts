import { describe, expect, it } from 'vitest';
import {
  resolveAccountFingerprint,
  accountFingerprintMatchesFilter,
  resolveFingerprintModels,
  fingerprintModelCounts,
} from './accountFingerprint';
import type { FingerprintSnapshot } from '@/types/fingerprint';
const summary = (s: Partial<FingerprintSnapshot>) =>
  resolveAccountFingerprint({
    name: 'synthetic.json',
    fingerprint_status: { enabled: true, manually_disabled: false, ...s },
  });
describe('fingerprint status', () => {
  it('separates quota deferral from the last verdict and preserves manual disable / mismatch priority', () => {
    const s: FingerprintSnapshot = {
      enabled: true,
      manually_disabled: false,
      effective: { models: ['sol'] },
      model_states: {
        sol: {
          blocked: false,
          wait: { reason: 'quota', scope: 'credential', retry_at: '2026-09-27T05:00:00Z' },
          result: {
            model: 'sol',
            expected_model: 'sol',
            status: 'match',
            used_outputs: 3,
            probability: 0.99,
          },
        },
      },
      current_results: [
        { model: 'sol', expected_model: 'sol', status: 'deferred', used_outputs: 0 },
      ],
    };
    expect(summary(s).state).toBe('waiting');
    expect(accountFingerprintMatchesFilter(summary(s), 'waiting')).toBe(true);
    expect(resolveFingerprintModels(s)[0]).toMatchObject({
      gate: 'allowed',
      wait: { reason: 'quota' },
      result: { status: 'match', probability: 0.99 },
    });
    s.model_states!.sol.blocked = true;
    expect(summary(s).state).toBe('blocked');
    s.manually_disabled = true;
    expect(summary(s).state).toBe('disabled');
    expect(resolveFingerprintModels(s)[0].wait).toBeUndefined();
    s.manually_disabled = false;
    s.enabled = false;
    expect(summary(s).state).toBe('unknown');
    expect(resolveFingerprintModels(s)[0].wait).toBeUndefined();
  });
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
  it('does not report unsupported, manually disabled or stale results as current successes', () => {
    const results = [{ model: 'a', expected_model: 'a', status: 'match', used_outputs: 3 }];
    expect(summary({ supported: false, results }).state).toBe('unsupported');
    expect(summary({ manually_disabled: true, running: true, results }).state).toBe('disabled');
    expect(summary({ results_stale: true, results }).state).toBe('stale');
    expect(summary({ results_stale: true, blocked: true, results }).state).toBe('blocked');
    expect(summary({ results_stale: true, running: true, results }).state).toBe('unclassified');
  });
});

describe('per-model display contract', () => {
  const fixture = (): FingerprintSnapshot => ({
    enabled: true,
    manually_disabled: false,
    blocked: true,
    effective: { models: ['sol', 'astra', 'pending'], confidence: 0.5 },
    model_states: {
      sol: {
        blocked: true,
        result: { model: 'sol', expected_model: 'sol', status: 'error', used_outputs: 0 },
        results_stale: true,
      },
      astra: { blocked: false },
    },
    results: [{ model: 'sol', expected_model: 'sol', status: 'match', used_outputs: 3 }],
  });
  it('keeps prior exclusions during errors, allows pending siblings and respects authoritative per-model results', () => {
    const s = fixture();
    const models = resolveFingerprintModels(s);
    expect(models.map((m) => m.gate)).toEqual(['blocked', 'allowed', 'allowed']);
    expect(models[0].result?.status).toBe('error');
    expect(models[0].threshold).toBeUndefined();
    expect(fingerprintModelCounts(s)).toEqual({ blocked: 1, total: 3 });
  });
  it('ignores removed model state and never substitutes the current threshold for an old result', () => {
    const s = fixture();
    s.effective!.models = ['astra'];
    expect(resolveFingerprintModels(s).map((m) => m.model)).toEqual(['astra']);
    expect(fingerprintModelCounts(s).blocked).toBe(0);
    s.effective!.models = ['sol'];
    s.model_states!.sol.result_policy = { confidence: 0.95 };
    expect(resolveFingerprintModels(s)[0].threshold).toBe(0.95);
  });
  it('shows current-cycle results once instead of duplicating old results', () => {
    const s = fixture();
    s.current_results = [
      { model: 'sol', expected_model: 'sol', status: 'match', confidence: 0.5, used_outputs: 3 },
    ];
    expect(resolveFingerprintModels(s)[0]).toMatchObject({
      stale: false,
      threshold: 0.5,
      result: { status: 'match' },
    });
  });
  it('configuration errors gate monitored models without calling them mismatches', () => {
    const s = fixture();
    s.configuration_error = 'fingerprint_state_invalid';
    expect(fingerprintModelCounts(s)).toEqual({ blocked: 3, total: 3 });
    expect(resolveFingerprintModels(s)[1].result).toBeUndefined();
    s.enabled = false;
    expect(fingerprintModelCounts(s).blocked).toBe(0);
  });
  it('manual disabled remains different from automatic per-model restriction', () => {
    const s = fixture();
    s.manually_disabled = true;
    expect(resolveFingerprintModels(s).every((m) => m.gate === 'disabled')).toBe(true);
    expect(summary(s).state).toBe('disabled');
  });
});

it('normalizes a current manual disable into the details snapshot', () => {
  const s = resolveAccountFingerprint({
    name: 'test',
    disabled: true,
    fingerprint_status: { enabled: true, manually_disabled: false, effective: { models: ['sol'] } },
  });
  expect(s.snapshot?.manually_disabled).toBe(true);
  expect(resolveFingerprintModels(s.snapshot)[0].gate).toBe('disabled');
});
it('mirrors the backend model-family gate for reasoning variants', () => {
  const s: FingerprintSnapshot = {
    enabled: true,
    manually_disabled: false,
    effective: { models: ['sol', 'sol(high)'] },
    model_states: { sol: { blocked: false }, 'sol(high)': { blocked: true } },
  };
  expect(resolveFingerprintModels(s).map((m) => m.gate)).toEqual(['blocked', 'blocked']);
});
