import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type {
  AuthFileConfigurationDraft,
  AuthFileConfigurationErrors,
} from '@/features/authFiles/model/authFileConfiguration';
import { LOCATION_FIELDS } from '@/features/authFiles/model/credentialPolicy';
import type { FingerprintPolicy } from '@/types/fingerprint';
import { FingerprintPolicyFields } from './FingerprintPolicyFields';
import styles from './CredentialPolicyFields.module.scss';
export interface CredentialPolicyFieldsProps {
  draft: AuthFileConfigurationDraft;
  errors: AuthFileConfigurationErrors;
  disabled: boolean;
  effective?: FingerprintPolicy;
  onChange: <K extends keyof AuthFileConfigurationDraft>(
    key: K,
    value: AuthFileConfigurationDraft[K]
  ) => void;
}
export function CredentialPolicyFields(props: CredentialPolicyFieldsProps) {
  const { draft, errors, disabled, onChange } = props;
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className={`${styles.wide} ${styles.sections}`}>
      <fieldset className={styles.root} disabled={disabled} data-credential-location-form>
        <legend>{t('accounts.policy_location_title')}</legend>
        <p className={styles.hint}>{t('accounts.policy_location_hint')}</p>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label id={`${id}-timezone-label`}>{t('accounts.timezone_mode')}</label>
            <Select
              value={draft.timezoneMode || 'inherit'}
              disabled={disabled}
              ariaLabelledBy={`${id}-timezone-label`}
              options={['inherit', 'custom', 'off'].map((value) => ({
                value,
                label: t(`accounts.timezone_${value}`),
              }))}
              onChange={(v) =>
                onChange('timezoneMode', v as AuthFileConfigurationDraft['timezoneMode'])
              }
            />
            {draft.timezoneMode === 'custom' && (
              <Input
                label={t('accounts.timezone_value')}
                value={draft.timezoneValue || ''}
                placeholder="Asia/Tokyo"
                disabled={disabled}
                error={errors.timezoneValue ? t(errors.timezoneValue) : undefined}
                onChange={(e) => onChange('timezoneValue', e.target.value)}
              />
            )}
          </div>
          {LOCATION_FIELDS.map((field) => (
            <div className={styles.field} key={field.key}>
              <label id={`${id}-${field.label}-label`}>{t(`accounts.policy_${field.label}`)}</label>
              <Select
                ariaLabelledBy={`${id}-${field.label}-label`}
                value={draft[field.mode] || 'inherit'}
                disabled={disabled}
                options={['inherit', 'custom', 'off'].map((value) => ({
                  value,
                  label: t(`accounts.policy_location_${value}`),
                }))}
                onChange={(value) =>
                  onChange(field.mode, value as AuthFileConfigurationDraft[typeof field.mode])
                }
              />
              {draft[field.mode] === 'custom' && (
                <Input
                  label={t(`accounts.policy_${field.label}_value`)}
                  value={draft[field.value] || ''}
                  disabled={disabled}
                  placeholder={field.example}
                  error={errors[field.value] ? t(errors[field.value]!) : undefined}
                  onChange={(e) => onChange(field.value, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </fieldset>
      <FingerprintPolicyFields {...props} />
    </div>
  );
}
