import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import {
  editFingerprintField,
  fingerprintObject,
  FINGERPRINT_NUMBERS,
  parseExpectedModels,
  parseFingerprintPolicy,
} from '@/features/authFiles/model/credentialPolicy';
import type { FingerprintPolicy } from '@/types/fingerprint';
import type { CredentialPolicyFieldsProps } from './CredentialPolicyFields';
import styles from './CredentialPolicyFields.module.scss';

export function FingerprintPolicyFields({
  draft,
  errors,
  disabled,
  onChange,
  effective,
}: CredentialPolicyFieldsProps) {
  const { t } = useTranslation();
  const id = useId();
  const text = draft.fingerprintText || '';
  let object: Record<string, unknown> | null = null;
  try {
    object = fingerprintObject(text);
  } catch {
    /* The advanced editor remains available for repair. */
  }
  const invalidJSON = object === null;
  const controlsDisabled = disabled || invalidJSON;
  const value = object || {};
  const options = (values: string[]) =>
    values.map((v) => ({ value: v, label: t(`accounts.policy_${v}`) }));
  const edit = (key: keyof FingerprintPolicy, next: unknown) => {
    if (!controlsDisabled) onChange('fingerprintText', editFingerprintField(text, key, next));
  };
  const editRaw = (raw: string) => {
    onChange('fingerprintText', raw);
    onChange('fingerprintModelsInput', undefined);
    onChange('fingerprintExpectedInput', undefined);
    onChange('fingerprintNumberInputs', undefined);
  };
  const fieldInvalid = (key: string) => {
    try {
      parseFingerprintPolicy(JSON.stringify({ [key]: value[key] }));
      return false;
    } catch {
      return true;
    }
  };
  const expectedText =
    draft.fingerprintExpectedInput ??
    (value['expected-models'] &&
    typeof value['expected-models'] === 'object' &&
    !Array.isArray(value['expected-models'])
      ? Object.entries(value['expected-models'])
          .map(([key, v]) => `${key} = ${String(v)}`)
          .join('\n')
      : typeof value['expected-models'] === 'string'
        ? value['expected-models']
        : '');
  const modelsText =
    draft.fingerprintModelsInput ??
    (Array.isArray(value.models)
      ? value.models.join('\n')
      : typeof value.models === 'string'
        ? value.models
        : '');

  return (
    <fieldset className={styles.root} disabled={disabled} data-credential-fingerprint-form>
      <legend>{t('accounts.policy_fingerprint_title')}</legend>
      <p className={styles.hint}>{t('accounts.policy_fingerprint_hint')}</p>
      {invalidJSON && (
        <p role="alert" className={styles.error}>
          {t('accounts.policy_invalid_json')}
        </p>
      )}
      <div className={styles.grid}>
        {(['enabled', 'retain-answers'] as const).map((key) => (
          <div className={styles.field} key={key}>
            <label id={`${id}-${key}-label`}>{t(`accounts.policy_${key}`)}</label>
            <Select
              ariaLabelledBy={`${id}-${key}-label`}
              value={
                value[key] == null
                  ? 'inherit'
                  : value[key] === true
                    ? 'on'
                    : value[key] === false
                      ? 'off'
                      : 'invalid'
              }
              disabled={controlsDisabled}
              options={options(['inherit', 'on', 'off'])}
              onChange={(v) => edit(key, v === 'inherit' ? undefined : v === 'on')}
            />
            {fieldInvalid(key) && (
              <p role="alert" className={styles.error}>
                {t('accounts.config_error_fingerprint')}
              </p>
            )}
          </div>
        ))}
        {FINGERPRINT_NUMBERS.map((field) => (
          <div className={styles.field} key={field.key}>
            <Input
              label={t(`accounts.policy_${field.key}`)}
              disabled={controlsDisabled}
              inputMode={field.key === 'confidence' ? 'decimal' : 'numeric'}
              value={
                draft.fingerprintNumberInputs?.[field.key] ??
                (value[field.key] == null ? '' : String(value[field.key]))
              }
              placeholder={t('accounts.policy_inherit')}
              hint={t('accounts.policy_numeric_hint', {
                min: field.min,
                max: field.max,
                current: effective?.[field.key] ?? t('accounts.policy_unavailable'),
              })}
              error={fieldInvalid(field.key) ? t('accounts.config_error_fingerprint') : undefined}
              onChange={(e) => {
                const raw = e.target.value;
                onChange('fingerprintNumberInputs', {
                  ...draft.fingerprintNumberInputs,
                  [field.key]: raw,
                });
                const number = Number(raw);
                edit(
                  field.key,
                  !raw.trim()
                    ? undefined
                    : Number.isFinite(number) && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim())
                      ? number
                      : raw
                );
              }}
            />
          </div>
        ))}
        <div className={`${styles.field} ${styles.wide}`}>
          <label id={`${id}-models-label`} htmlFor={`${id}-models`}>
            {t('accounts.policy_models')}
          </label>
          <Select
            ariaLabelledBy={`${id}-models-label`}
            value={value.models == null ? 'inherit' : 'custom'}
            disabled={controlsDisabled}
            options={options(['inherit', 'custom'])}
            onChange={(v) => {
              edit(
                'models',
                v === 'inherit'
                  ? undefined
                  : effective?.models?.length
                    ? [...effective.models]
                    : ['gpt-6-sol', 'gpt-6-astra']
              );
              onChange('fingerprintModelsInput', undefined);
            }}
          />
          {value.models != null && (
            <textarea
              id={`${id}-models`}
              className={`input ${styles.text}`}
              rows={3}
              disabled={controlsDisabled}
              aria-invalid={fieldInvalid('models')}
              value={modelsText}
              onChange={(e) => {
                onChange('fingerprintModelsInput', e.target.value);
                edit(
                  'models',
                  e.target.value
                    .split(/[\n,]+/)
                    .map((m) => m.trim())
                    .filter(Boolean)
                );
              }}
            />
          )}
          <p className={styles.hint}>{t('accounts.policy_models_hint')}</p>
          {fieldInvalid('models') && (
            <p role="alert" className={styles.error}>
              {t('accounts.config_error_fingerprint')}
            </p>
          )}
        </div>
        <div className={`${styles.field} ${styles.wide}`}>
          <label id={`${id}-expected-label`} htmlFor={`${id}-expected`}>
            {t('accounts.policy_expected-models')}
          </label>
          <Select
            ariaLabelledBy={`${id}-expected-label`}
            value={value['expected-models'] == null ? 'inherit' : 'custom'}
            disabled={controlsDisabled}
            options={options(['inherit', 'custom'])}
            onChange={(v) => {
              edit('expected-models', v === 'inherit' ? undefined : {});
              onChange('fingerprintExpectedInput', undefined);
            }}
          />
          {value['expected-models'] != null && (
            <textarea
              id={`${id}-expected`}
              className={`input ${styles.text}`}
              rows={3}
              disabled={controlsDisabled}
              aria-invalid={fieldInvalid('expected-models')}
              value={expectedText}
              placeholder="gpt-6 = gpt-6-astra"
              onChange={(e) => {
                onChange('fingerprintExpectedInput', e.target.value);
                let next: unknown = e.target.value;
                try {
                  next = parseExpectedModels(e.target.value);
                } catch {
                  /* Invalid input stays visible and blocks saving. */
                }
                edit('expected-models', next);
              }}
            />
          )}
          <p className={styles.hint}>{t('accounts.policy_expected_hint')}</p>
          {fieldInvalid('expected-models') && (
            <p role="alert" className={styles.error}>
              {t('accounts.config_error_fingerprint')}
            </p>
          )}
        </div>
      </div>
      <p className={styles.hint}>{t('accounts.policy_global_only_hint')}</p>
      <details className={styles.advanced} open={invalidJSON || undefined}>
        <summary>{t('accounts.policy_advanced_json')}</summary>
        <label htmlFor={`${id}-raw`}>{t('accounts.fingerprint_config')}</label>
        <textarea
          id={`${id}-raw`}
          className={`input ${styles.text}`}
          rows={10}
          disabled={disabled}
          value={text}
          aria-invalid={Boolean(errors.fingerprintText)}
          onChange={(e) => editRaw(e.target.value)}
        />
      </details>
      {errors.fingerprintText && (
        <p role="alert" className={styles.error}>
          {t(errors.fingerprintText)}
        </p>
      )}
      <Button variant="secondary" disabled={disabled || !text} onClick={() => editRaw('')}>
        {t('accounts.policy_reset_fingerprint')}
      </Button>
    </fieldset>
  );
}
