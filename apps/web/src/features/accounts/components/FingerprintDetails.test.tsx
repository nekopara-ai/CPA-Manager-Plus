import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { FingerprintDetails } from './FingerprintDetails';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
describe('fingerprint details', () => {
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
    expect(text).toContain('fingerprint_model_blocked');
    expect(text).toContain('fingerprint_model_allowed');
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
