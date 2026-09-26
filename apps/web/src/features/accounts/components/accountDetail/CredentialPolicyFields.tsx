import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type {
  AuthFileConfigurationDraft,
  AuthFileConfigurationErrors,
} from '@/features/authFiles/model/authFileConfiguration';
interface Props {
  draft: AuthFileConfigurationDraft;
  errors: AuthFileConfigurationErrors;
  disabled: boolean;
  onChange: <K extends keyof AuthFileConfigurationDraft>(
    key: K,
    value: AuthFileConfigurationDraft[K]
  ) => void;
}
export function CredentialPolicyFields({ draft, errors, disabled, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <fieldset disabled={disabled}>
      <legend>{t('accounts.credential_policy_title')}</legend>
      <label>{t('accounts.timezone_mode')}</label>
      <Select
        value={draft.timezoneMode || 'inherit'}
        disabled={disabled}
        ariaLabel={t('accounts.timezone_mode')}
        options={['inherit', 'custom', 'off'].map((value) => ({
          value,
          label: t(`accounts.timezone_${value}`),
        }))}
        onChange={(v) => onChange('timezoneMode', v as AuthFileConfigurationDraft['timezoneMode'])}
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
      <label htmlFor="credential-fingerprint-policy">{t('accounts.fingerprint_config')}</label>
      <p>{t('accounts.fingerprint_config_hint')}</p>
      <textarea
        disabled={disabled}
        id="credential-fingerprint-policy"
        rows={12}
        style={{ width: '100%', fontFamily: 'monospace' }}
        value={draft.fingerprintText || ''}
        onChange={(e) => onChange('fingerprintText', e.target.value)}
        placeholder={
          '{\n  "enabled": true,\n  "models": ["gpt-6-sol", "gpt-6-astra"],\n  "interval-seconds": 3600,\n  "cooldown-seconds": 1800,\n  "confidence": 0.95\n}'
        }
      />
      {errors.fingerprintText && <p role="alert">{t(errors.fingerprintText)}</p>}
    </fieldset>
  );
}
