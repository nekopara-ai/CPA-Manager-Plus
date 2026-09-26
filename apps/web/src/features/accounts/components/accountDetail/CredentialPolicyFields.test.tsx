import { useEffect, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import {
  buildAuthFileConfigurationDraft,
  buildAuthFileConfigurationPatch,
  type AuthFileConfigurationDraft,
  type AuthFileConfigurationPatchResult,
} from '@/features/authFiles/model/authFileConfiguration';
import { FINGERPRINT_NUMBERS, LOCATION_FIELDS } from '@/features/authFiles/model/credentialPolicy';
import type { FingerprintPolicy } from '@/types/fingerprint';
import { CredentialPolicyFields } from './CredentialPolicyFields';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { current?: unknown }) =>
      options?.current !== undefined ? `${key}:${options.current}` : key,
  }),
}));

describe('CredentialPolicyFields', () => {
  let renderer: ReactTestRenderer;
  let latest: AuthFileConfigurationDraft;
  let result: AuthFileConfigurationPatchResult;
  const render = (
    record: Record<string, unknown> = {},
    disabled = false,
    effective?: FingerprintPolicy
  ) => {
    const original = buildAuthFileConfigurationDraft(record, 'codex');
    function Harness() {
      const [draft, setDraft] = useState(original);
      const changes = buildAuthFileConfigurationPatch(record, 'codex', original, draft);
      useEffect(() => {
        latest = draft;
        result = changes;
      });
      return (
        <CredentialPolicyFields
          draft={draft}
          errors={changes.errors}
          disabled={disabled}
          effective={effective}
          onChange={(key, value) => setDraft((d) => ({ ...d, [key]: value }))}
        />
      );
    }
    act(() => {
      renderer = create(<Harness />);
    });
  };
  afterEach(() => {
    act(() => renderer?.unmount());
  });
  const select = (key: string) =>
    renderer.root
      .findAllByType(Select)
      .find((s) => s.props.ariaLabelledBy?.endsWith(`-${key}-label`))!;
  const input = (key: string) =>
    renderer.root.findAllByType(Input).find((i) => i.props.label === `accounts.policy_${key}`)!;
  const textarea = (key: string) =>
    renderer.root.findAllByType('textarea').find((t) => t.props.id.endsWith(`-${key}`))!;
  const choose = (key: string, value: string) => act(() => select(key).props.onChange(value));
  const enter = (key: string, value: string) =>
    act(() => input(key).props.onChange({ target: { value } }));
  const enterText = (key: string, value: string) =>
    act(() => textarea(key).props.onChange({ target: { value } }));
  const policy = () => JSON.parse(latest.fingerprintText || '{}');

  it('exposes every geography field with custom, off and inheritance modes', () => {
    render();
    choose('timezone', 'custom');
    const timezone = renderer.root
      .findAllByType(Input)
      .find((i) => i.props.label === 'accounts.timezone_value')!;
    act(() => timezone.props.onChange({ target: { value: 'Asia/Tokyo' } }));
    for (const field of LOCATION_FIELDS) {
      choose(field.label, 'custom');
      enter(`${field.label}_value`, field.example);
      expect(result.patch[field.key]).toBe(field.example);
      choose(field.label, 'off');
      expect(result.patch[field.key]).toBe('');
      choose(field.label, 'inherit');
      expect(result.patch[field.key]).toBeNull();
    }
    expect(result.errors).toEqual({});
    expect(result.patch.timezone_override).toBe('Asia/Tokyo');
  });

  it('has visual controls for all 13 fingerprint parameters and preserves unknown keys', () => {
    render({ fingerprint: { future: { keep: true } } });
    choose('enabled', 'off');
    choose('retain-answers', 'on');
    for (const field of FINGERPRINT_NUMBERS)
      enter(field.key, String(field.key === 'question-retries' ? 0 : field.default));
    choose('models', 'custom');
    enterText('models', 'gpt-6-sol\ngpt-6-astra\n');
    choose('expected', 'custom');
    enterText('expected', 'gpt-6-sol = gpt-6-sol\ngpt-6-astra = gpt-6-astra\n');
    expect(result.errors).toEqual({});
    expect(policy()).toMatchObject({
      enabled: false,
      'retain-answers': true,
      'question-retries': 0,
      models: ['gpt-6-sol', 'gpt-6-astra'],
      'expected-models': { 'gpt-6-sol': 'gpt-6-sol', 'gpt-6-astra': 'gpt-6-astra' },
      future: { keep: true },
    });
    expect(Object.keys(result.patch.fingerprint!)).toHaveLength(14);
    expect(textarea('raw').props.value).toBe(latest.fingerprintText);
    expect(textarea('models').props.value).toBe('gpt-6-sol\ngpt-6-astra\n');
    expect(textarea('expected').props.value).toMatch(/\n$/);
  });

  it('lets users type fractional confidence and rejects invalid numeric notation', () => {
    render();
    enter('confidence', '0.');
    expect(input('confidence').props.value).toBe('0.');
    expect(result.errors.fingerprintText).toBeTruthy();
    enter('confidence', '0.97');
    expect(policy().confidence).toBe(0.97);
    expect(result.errors).toEqual({});
    for (const invalid of ['0x20', '1e3', 'NaN', 'Infinity', '-1', '1.1']) {
      enter('interval-seconds', invalid);
      expect(input('interval-seconds').props.value).toBe(invalid);
      expect(result.errors.fingerprintText).toBeTruthy();
    }
    enter('interval-seconds', '120');
    expect(result.errors).toEqual({});
    enter('interval-seconds', '');
    expect(policy()['interval-seconds']).toBeUndefined();
  });

  it('uses reported effective values as hints without silently writing defaults', () => {
    render({}, false, { 'interval-seconds': 7200, models: ['gpt-6-astra'] });
    expect(input('interval-seconds').props.value).toBe('');
    expect(input('interval-seconds').props.hint).toContain('7200');
    expect(result.patch).toEqual({});
    choose('models', 'custom');
    expect(policy().models).toEqual(['gpt-6-astra']);
    choose('models', 'inherit');
    expect(result.patch).toEqual({});
  });

  it('distinguishes explicit empty mapping from inherited mapping and preserves invalid drafts', () => {
    render({ fingerprint: { 'expected-models': { requested: 'label' } } });
    enterText('expected', 'requested =\n');
    expect(result.errors.fingerprintText).toBeTruthy();
    expect(textarea('expected').props.value).toBe('requested =\n');
    enterText('expected', '');
    expect(policy()['expected-models']).toEqual({});
    expect(result.patch.fingerprint).toEqual({ 'expected-models': {} });
    choose('expected', 'inherit');
    expect(result.patch.fingerprint).toBeNull();
    expect(textarea('raw').props.value).toBe('');
  });

  it('blocks empty and duplicate model lists instead of silently changing them', () => {
    render();
    choose('models', 'custom');
    for (const invalid of ['', 'gpt-6-sol\ngpt-6-sol']) {
      enterText('models', invalid);
      expect(result.errors.fingerprintText).toBeTruthy();
      expect(textarea('models').props.value).toBe(invalid);
    }
    enterText('models', 'gpt-6-sol,gpt-6-astra');
    expect(result.errors).toEqual({});
  });

  it('does not reset model lists, mappings or partial drafts when reselecting Custom', () => {
    const fingerprint = {
      models: ['gpt-6-sol'],
      'expected-models': { 'gpt-6-sol': 'gpt-6-sol' },
    };
    render({ fingerprint }, false, { models: ['gpt-6-astra'] });
    choose('models', 'custom');
    choose('expected', 'custom');
    expect(policy()).toEqual(fingerprint);
    expect(result.patch).toEqual({});
    enterText('models', 'gpt-6-sol\n');
    enterText('expected', 'gpt-6-sol =\n');
    choose('models', 'custom');
    choose('expected', 'custom');
    expect(textarea('models').props.value).toBe('gpt-6-sol\n');
    expect(textarea('expected').props.value).toBe('gpt-6-sol =\n');
    expect(result.errors.fingerprintText).toBeTruthy();
  });

  it('synchronizes advanced JSON edits, leaves malformed JSON repairable, and resets all overrides', () => {
    render({ fingerprint: { enabled: true } });
    enter('confidence', '0.99');
    choose('models', 'custom');
    enterText('models', 'old-draft\n');
    enterText('raw', '{"enabled":false,"confidence":0.96,"models":["gpt-6-astra"]}');
    expect(select('enabled').props.value).toBe('off');
    expect(input('confidence').props.value).toBe('0.96');
    expect(textarea('models').props.value).toBe('gpt-6-astra');
    enterText('raw', '{');
    expect(select('enabled').props.disabled).toBe(true);
    expect(input('confidence').props.disabled).toBe(true);
    expect(textarea('raw').props.disabled).toBe(false);
    expect(renderer.root.findByType('details').props.open).toBe(true);
    expect(result.errors.fingerprintText).toBeTruthy();
    const reset = renderer.root.findByType(Button);
    act(() => reset.props.onClick());
    expect(result.patch.fingerprint).toBeNull();
    expect(latest.fingerprintNumberInputs).toBeUndefined();
    expect(latest.fingerprintModelsInput).toBeUndefined();
    expect(select('enabled').props.value).toBe('inherit');
    expect(input('confidence').props.value).toBe('');
    expect(result.errors).toEqual({});
  });

  it('disables every interactive control during saves or read-only access', () => {
    render(
      {
        timezone_override: 'Asia/Tokyo',
        timezone_override_country: 'JP',
        fingerprint: { enabled: true, models: ['gpt-6-astra'], 'expected-models': {} },
      },
      true
    );
    for (const type of [Select, Input, Button] as const) {
      expect(renderer.root.findAllByType(type).every((c) => c.props.disabled === true)).toBe(true);
    }
    expect(renderer.root.findAllByType('textarea').every((t) => t.props.disabled === true)).toBe(
      true
    );
  });
});
