import { isMap, type parseDocument } from 'yaml';
import {
  EMPTY_MINT_CONFIG,
  MINT_BOOLEAN_DEFAULTS,
  MINT_KEYS,
  MINT_LISTS,
  MINT_NUMBERS,
  type GatewayMintConfigKey,
  type GatewayMintConfigValues,
} from '@/types/gatewayMintConfig';
import type { VisualConfigValidationErrors } from '@/types/visualConfig';

export const mintList = (value: string): string[] => [
  ...new Set(
    value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  ),
];
export function parseMintConfig(codex: Record<string, unknown> | null): GatewayMintConfigValues {
  const raw = codex?.['turn-ticket'];
  if (raw == null) return { ...EMPTY_MINT_CONFIG };
  if (typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('codex.turn-ticket must be a mapping');
  const source = raw as Record<string, unknown>;
  return Object.fromEntries(
    MINT_KEYS.map((key) => {
      const value = source[key];
      if (value == null) return [key, ''];
      if (MINT_LISTS.includes(key as (typeof MINT_LISTS)[number])) {
        if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
          throw new Error(`codex.turn-ticket.${key} must be a string list`);
        if (key === 'mint-transports' && !value.length)
          throw new Error('mint-transports must not be empty');
        return [key, value.join('\n')];
      }
      if (key in MINT_BOOLEAN_DEFAULTS && typeof value !== 'boolean')
        throw new Error(`codex.turn-ticket.${key} must be boolean`);
      return [key, String(value)];
    })
  ) as GatewayMintConfigValues;
}
export function validateMintConfig(value = EMPTY_MINT_CONFIG): VisualConfigValidationErrors {
  const errors: VisualConfigValidationErrors = {};
  for (const [name, [min, max]] of Object.entries(MINT_NUMBERS)) {
    const key = name as keyof typeof MINT_NUMBERS;
    const raw = value[key].trim();
    if (
      raw &&
      (!/^\d+$/.test(raw) ||
        !Number.isSafeInteger(Number(raw)) ||
        Number(raw) < min ||
        Number(raw) > max)
    ) {
      errors[`codexTurnTicket.${key}`] = 'mint_range';
    }
  }
  for (const key of Object.keys(MINT_BOOLEAN_DEFAULTS) as (keyof typeof MINT_BOOLEAN_DEFAULTS)[]) {
    if (!['', 'true', 'false'].includes(value[key]))
      errors[`codexTurnTicket.${key}`] = 'mint_range';
  }
  if (
    /[\r\n]/.test(value['mint-gateway']) ||
    value['mint-gateway'].includes(String.fromCharCode(0)) ||
    new TextEncoder().encode(value['mint-gateway']).length > 96
  ) {
    errors['codexTurnTicket.mint-gateway'] = 'mint_gateway';
  }
  if (mintList(value['mint-transports']).some((s) => s !== 'sse' && s !== 'websocket')) {
    errors['codexTurnTicket.mint-transports'] = 'mint_transports';
  }
  return errors;
}

/** Only update edited keys, preserving unknown fields, comments and explicit false/zero. */
export function applyMintConfig(
  doc: ReturnType<typeof parseDocument>,
  values: GatewayMintConfigValues,
  dirty: (key: string) => boolean
): void {
  const keys = MINT_KEYS.filter((key) => dirty(`codexTurnTicket.${key}`));
  if (!keys.length) return;
  if (Object.keys(validateMintConfig(values)).length)
    throw new Error('Invalid gateway mint settings');
  for (const path of [['codex'], ['codex', 'turn-ticket']]) {
    if (!doc.hasIn(path)) doc.setIn(path, doc.createNode({}));
    if (!isMap(doc.getIn(path, true))) throw new Error(`${path.join('.')} must be a mapping`);
  }
  for (const key of keys) {
    const path = ['codex', 'turn-ticket', key];
    const value = values[key].trim();
    if (!value) {
      doc.deleteIn(path);
      continue;
    }
    if (key in MINT_BOOLEAN_DEFAULTS) doc.setIn(path, value === 'true');
    else if (key in MINT_NUMBERS) doc.setIn(path, Number(value));
    else if (MINT_LISTS.includes(key as (typeof MINT_LISTS)[number]))
      doc.setIn(path, mintList(value));
    else doc.setIn(path, value);
  }
}
export const mintConfigKey = (key: GatewayMintConfigKey) =>
  `gateway_mint.config_${key.replace(/-/g, '_')}`;
