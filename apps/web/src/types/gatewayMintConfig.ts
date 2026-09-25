/** Raw YAML form values. Empty means inherit; explicit false/zero must survive saves. */
export const MINT_BOOLEAN_DEFAULTS = {
  enabled: false,
  'adaptive-injection': true,
  'gateway-mint': true,
  'injection-enabled': true,
  'fail-closed': true,
} as const;
export const MINT_NUMBERS = {
  'mint-ticket-length': [0, 16384, ''],
  'mint-ticket-ttl-seconds': [0, 1200, '240'],
  'mint-pair-ttl-seconds': [0, 86400, '3900'],
  'mint-max-attempts': [0, 128, '24'],
  'mint-total-timeout-seconds': [0, 180, '75'],
  'mint-retry-cooldown-seconds': [0, 3600, '30'],
  'mint-cache-capacity': [0, 65536, '256'],
  'mint-workers': [0, 32, '4'],
} as const;
export const MINT_LISTS = ['models', 'auth-ids', 'harvest-proxy-urls', 'mint-transports'] as const;
export type GatewayMintConfigKey =
  | keyof typeof MINT_BOOLEAN_DEFAULTS
  | keyof typeof MINT_NUMBERS
  | (typeof MINT_LISTS)[number]
  | 'mint-gateway';
export type GatewayMintConfigValues = Record<GatewayMintConfigKey, string>;
export const MINT_KEYS: GatewayMintConfigKey[] = [
  ...(Object.keys(MINT_BOOLEAN_DEFAULTS) as (keyof typeof MINT_BOOLEAN_DEFAULTS)[]),
  'mint-gateway',
  ...(Object.keys(MINT_NUMBERS) as (keyof typeof MINT_NUMBERS)[]),
  ...MINT_LISTS,
];
export const EMPTY_MINT_CONFIG = Object.fromEntries(
  MINT_KEYS.map((key) => [key, ''])
) as GatewayMintConfigValues;
