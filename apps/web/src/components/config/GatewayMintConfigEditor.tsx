import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  EMPTY_MINT_CONFIG,
  MINT_BOOLEAN_DEFAULTS,
  MINT_LISTS,
  MINT_NUMBERS,
  type GatewayMintConfigKey,
  type GatewayMintConfigValues,
} from '@/types/gatewayMintConfig';
import { mintConfigKey, validateMintConfig } from '@/hooks/gatewayMintConfig';
import styles from './VisualConfigEditor.module.scss';

export function GatewayMintConfigEditor({
  value = EMPTY_MINT_CONFIG,
  onChange,
  disabled = false,
}: {
  value?: GatewayMintConfigValues;
  onChange: (value: GatewayMintConfigValues) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const id = useId();
  const change = (key: GatewayMintConfigKey, next: string) => onChange({ ...value, [key]: next });
  const errors = validateMintConfig(value);
  const enabled = value.enabled === 'true';
  const gateway = value['adaptive-injection'] !== 'false' && value['gateway-mint'] !== 'false';
  const strict = value['fail-closed'] !== 'false';
  return (
    <div className={styles.sectionStack} data-gateway-mint-config="true">
      <p>{t('gateway_mint.config_boundary')}</p>
      {enabled && strict ? (
        <div className="hint" role="note">
          {t('gateway_mint.strict_warning')}
        </div>
      ) : null}
      {enabled && strict && value['injection-enabled'] === 'false' ? (
        <div className="error-box" role="alert">
          {t('gateway_mint.probe_block_warning')}
        </div>
      ) : null}
      {!gateway ? <div className="hint">{t('gateway_mint.legacy_config')}</div> : null}
      <div className={styles.sectionGrid}>
        {(Object.keys(MINT_BOOLEAN_DEFAULTS) as (keyof typeof MINT_BOOLEAN_DEFAULTS)[]).map(
          (key) => (
            <div key={key} className={styles.fieldShell}>
              <label id={`${id}-${key}`} className={styles.fieldLabel}>
                {t(mintConfigKey(key))}
              </label>
              <Select
                ariaLabelledBy={`${id}-${key}`}
                value={value[key]}
                disabled={disabled}
                options={[
                  {
                    value: '',
                    label: t('gateway_mint.inherit_boolean', {
                      value: t(MINT_BOOLEAN_DEFAULTS[key] ? 'gateway_mint.on' : 'gateway_mint.off'),
                    }),
                  },
                  { value: 'true', label: t('gateway_mint.on') },
                  { value: 'false', label: t('gateway_mint.off') },
                ]}
                onChange={(next) => change(key, next)}
              />
            </div>
          )
        )}
      </div>
      <p className="hint">{t('gateway_mint.mandatory')}</p>
      <div className={styles.sectionGrid}>
        <Input
          label={t(mintConfigKey('mint-gateway'))}
          value={value['mint-gateway']}
          placeholder="unified-88"
          hint={t('gateway_mint.gateway_hint')}
          disabled={disabled || !gateway}
          onChange={(event) => change('mint-gateway', event.target.value)}
          error={
            errors['codexTurnTicket.mint-gateway'] ? t('gateway_mint.invalid_gateway') : undefined
          }
        />
        {(
          Object.entries(MINT_NUMBERS) as [
            keyof typeof MINT_NUMBERS,
            readonly [number, number, string],
          ][]
        ).map(([key, [min, max, fallback]]) => (
          <Input
            key={key}
            label={t(mintConfigKey(key))}
            value={value[key]}
            type="number"
            min={min}
            max={max}
            step="1"
            placeholder={key === 'mint-ticket-length' ? t('gateway_mint.inherit_length') : fallback}
            hint={
              key === 'mint-ticket-length'
                ? t('gateway_mint.length_hint')
                : t('gateway_mint.number_hint', { max, fallback })
            }
            disabled={disabled || !gateway}
            onChange={(event) => change(key, event.target.value)}
            error={
              errors[`codexTurnTicket.${key}`]
                ? t('gateway_mint.invalid_number', { min, max })
                : undefined
            }
          />
        ))}
      </div>
      <p className="hint">{t('gateway_mint.scope_config_hint')}</p>
      <div className={styles.sectionGrid}>
        {MINT_LISTS.map((key) => (
          <div key={key} className={styles.fieldShell}>
            <label htmlFor={`${id}-list-${key}`} className={styles.fieldLabel}>
              {t(mintConfigKey(key))}
            </label>
            <textarea
              id={`${id}-list-${key}`}
              className="input"
              rows={3}
              value={value[key]}
              disabled={disabled}
              onChange={(event) => change(key, event.target.value)}
              aria-invalid={Boolean(errors[`codexTurnTicket.${key}`])}
              placeholder={key === 'mint-transports' ? 'sse\nwebsocket' : ''}
            />
            {key === 'mint-transports' ? (
              <div className="hint">{t('gateway_mint.transports_hint')}</div>
            ) : null}
            {errors[`codexTurnTicket.${key}`] ? (
              <div className="error-box">{t('gateway_mint.invalid_transports')}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
