import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { FingerprintDetails } from './FingerprintDetails';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
describe('fingerprint details', () => {
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
});
