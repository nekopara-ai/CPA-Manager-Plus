import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { FingerprintDetails } from './FingerprintDetails';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
describe('fingerprint details', () => {
  it('renders quota as waiting, retaining the previous real verdict rather than an error or zero score', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <FingerprintDetails
          summary={{
            state: 'waiting',
            snapshot: {
              enabled: true,
              manually_disabled: false,
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
            },
          }}
        />
      );
    });
    const text = JSON.stringify(renderer!.toJSON());
    expect(text).toContain('fingerprint_wait_quota');
    expect(text).toContain('fingerprint_wait_preserved');
    expect(text).toContain('fingerprint_wait_retry');
    expect(text).toContain('fingerprint_result_match');
    expect(text).toContain('99.00%');
    expect(text).not.toContain('fingerprint_result_error');
    expect(text).not.toContain('0.00%');
    await act(async () => renderer!.unmount());
  });
  it('shows independent model blocks without claiming the entire credential is disabled', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <FingerprintDetails
          summary={{
            state: 'blocked',
            snapshot: {
              enabled: true,
              manually_disabled: false,
              blocked: true,
              model_states: {
                'gpt-6-sol': { blocked: true, cooldown_until: '2026-09-27T03:00:00Z' },
                'gpt-6-astra': { blocked: false },
              },
            },
          }}
        />
      );
    });
    const text = JSON.stringify(renderer!.toJSON());
    expect(text).toContain('fingerprint_gate_blocked');
    expect(text).toContain('fingerprint_gate_allowed');
    expect(text).toContain('fingerprint_model_scope');
    expect(text).not.toContain('fingerprint_manual_disabled');
    await act(async () => renderer!.unmount());
  });
  it('shows missing probabilities as unavailable rather than zero and preserves the cooldown reason', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <FingerprintDetails
          summary={{
            state: 'blocked',
            snapshot: {
              enabled: true,
              manually_disabled: true,
              blocked: true,
              trigger_model: 'gpt-6-astra',
              results: [
                {
                  model: 'gpt-6-astra',
                  expected_model: 'gpt-6-astra',
                  status: 'insufficient',
                  used_outputs: 0,
                },
              ],
            },
          }}
        />
      );
    });
    const text = JSON.stringify(renderer!.toJSON());
    expect(text).toContain('fingerprint_manual_disabled');
    expect(text).toContain('gpt-6-astra');
    expect(text).not.toContain('0.00%');
    await act(async () => renderer!.unmount());
  });
  it('shows historical and current thresholds separately and labels legacy thresholds unknown', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <FingerprintDetails
          summary={{
            state: 'stale',
            snapshot: {
              enabled: true,
              manually_disabled: false,
              results_stale: true,
              effective: { confidence: 0.5 },
              result_policy: { confidence: 0.95 },
              results: [
                {
                  model: 'gpt-6-sol',
                  expected_model: 'gpt-6-sol',
                  status: 'inconclusive',
                  probability: 0.8586,
                  used_outputs: 3,
                  confidence: 0.95,
                },
              ],
              history: [
                {
                  at: '2026-09-26T15:36:22Z',
                  results: [
                    { model: 'old', expected_model: 'old', status: 'match', used_outputs: 3 },
                  ],
                },
              ],
            },
          }}
        />
      );
    });
    const text = JSON.stringify(renderer!.toJSON());
    expect(text).toContain('fingerprint_stale_hint');
    expect(text).toContain('50.00%');
    expect(text).toContain('95.00%');
    expect(text).toContain('85.86%');
    expect(text).toContain('fingerprint_threshold_unknown');
    await act(async () => renderer!.unmount());
  });
  it('shows live progress rather than an overdue next-run time', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <FingerprintDetails
          summary={{
            state: 'unclassified',
            snapshot: {
              enabled: true,
              manually_disabled: false,
              running: true,
              next_run_at: '2020-01-01T00:00:00Z',
              progress: {
                started_at: '2026-09-26T15:36:22Z',
                model: 'gpt-6-sol',
                question: 2,
                attempt: 1,
                completed_questions: 1,
                total_questions: 6,
                request_started_at: '2026-09-26T15:36:24Z',
                received_bytes: 123,
              },
            },
          }}
        />
      );
    });
    const text = JSON.stringify(renderer!.toJSON());
    expect(text).toContain('data-fingerprint-progress');
    expect(text).toContain('fingerprint_next_after_run');
    expect(text).not.toContain('2020');
    expect(text).toContain('123');
    expect(text).not.toContain('0.00%');
    await act(async () => renderer!.unmount());
  });
});

describe('compact model cards', () => {
  it('uses one card per configured model, includes pending models and collapses history', async () => {
    let renderer: ReturnType<typeof create>;
    await act(async () => {
      renderer = create(
        <FingerprintDetails
          summary={{
            state: 'blocked',
            snapshot: {
              enabled: true,
              manually_disabled: false,
              effective: { models: ['sol', 'astra', 'pending'] },
              blocked: true,
              model_states: {
                sol: {
                  blocked: true,
                  result: {
                    model: 'sol',
                    expected_model: 'sol',
                    status: 'mismatch',
                    prediction: 'other',
                    probability: 0.999,
                    confidence: 0.5,
                    used_outputs: 3,
                  },
                },
                astra: { blocked: false },
              },
              results: [
                { model: 'sol', expected_model: 'sol', status: 'mismatch', used_outputs: 3 },
              ],
              history: [{ at: '2026-09-27T00:00:00Z', results: [] }],
            },
          }}
        />
      );
    });
    const cards = renderer!.root.findAllByType('article');
    expect(cards.map((c) => c.props['data-model'])).toEqual(['sol', 'astra', 'pending']);
    expect(cards.map((c) => c.props['data-gate'])).toEqual(['blocked', 'allowed', 'allowed']);
    expect(
      renderer!.root.findByProps({ 'data-fingerprint-history': true }).props.open
    ).toBeUndefined();
    expect(JSON.stringify(renderer!.toJSON())).toContain('99.90%');
    await act(async () => renderer!.unmount());
  });
  it.each([
    ['disabled', true, true],
    ['off', false, false],
  ] as const)(
    'never displays green allowed or an active retest for %s',
    async (gate, manual, enabled) => {
      let renderer: ReturnType<typeof create>;
      await act(async () => {
        renderer = create(
          <FingerprintDetails
            summary={{
              state: manual ? 'disabled' : 'unknown',
              snapshot: {
                enabled,
                manually_disabled: manual,
                running: true,
                configuration_error: 'retained diagnostic error',
                model_states: { sol: { blocked: true }, astra: { blocked: false } },
              },
            }}
          />
        );
      });
      expect(renderer!.root.findAllByType('article').map((c) => c.props['data-gate'])).toEqual([
        gate,
        gate,
      ]);
      expect(renderer!.root.findAllByProps({ 'data-fingerprint-progress': true })).toHaveLength(0);
      const text = JSON.stringify(renderer!.toJSON());
      expect(text).toContain('fingerprint_inactive_error_hint');
      expect(text).not.toContain('fingerprint_config_error_hint');
      await act(async () => renderer!.unmount());
    }
  );
});
