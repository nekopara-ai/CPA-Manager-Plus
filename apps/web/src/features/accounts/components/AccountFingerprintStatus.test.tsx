import { act, create } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';
import { AccountFingerprintStatus } from './AccountFingerprintStatus';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number; total?: number }) =>
      values ? `${key}:${values.count}/${values.total}` : key,
  }),
}));
describe('fingerprint list badge', () => {
  it.each([1, 2])(
    'labels %i restricted models without claiming the whole credential is disabled',
    async (count) => {
      let renderer: ReturnType<typeof create>;
      const onOpen = vi.fn();
      await act(async () => {
        renderer = create(
          <AccountFingerprintStatus
            provider="codex"
            onOpen={onOpen}
            summary={{
              state: 'blocked',
              snapshot: {
                enabled: true,
                manually_disabled: false,
                blocked: true,
                running: true,
                effective: { models: ['sol', 'astra'] },
                model_states: { sol: { blocked: true }, astra: { blocked: count === 2 } },
              },
            }}
          />
        );
      });
      const text = JSON.stringify(renderer!.toJSON());
      expect(text).toContain(`fingerprint_blocked_count:${count}/2`);
      expect(text).toContain('fingerprint_rechecking');
      await act(async () =>
        renderer!.root.findByType('button').props.onClick({ stopPropagation: vi.fn() })
      );
      expect(onOpen).toHaveBeenCalledOnce();
      await act(async () => renderer!.unmount());
    }
  );
});
