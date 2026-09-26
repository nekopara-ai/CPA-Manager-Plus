/** Bank-relative classification, not cryptographic model identity verification. */
export interface FingerprintPolicy {
  enabled?: boolean;
  models?: string[];
  'expected-models'?: Record<string, string>;
  'interval-seconds'?: number;
  'cooldown-seconds'?: number;
  'retry-seconds'?: number;
  'max-retry-seconds'?: number;
  confidence?: number;
  'minimum-answers'?: number;
  'question-retries'?: number;
  'daily-request-limit'?: number;
  'history-limit'?: number;
  'retain-answers'?: boolean;
}
export interface FingerprintResult {
  model: string;
  expected_model: string;
  status: string;
  prediction?: string;
  probability?: number;
  used_outputs: number;
  parsed_numbers?: number[];
  bank_version?: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
}
export interface FingerprintSnapshot {
  enabled: boolean;
  manually_disabled: boolean;
  blocked?: boolean;
  running?: boolean;
  reason?: string;
  trigger_model?: string;
  last_run_at?: string;
  next_run_at?: string;
  cooldown_until?: string;
  configuration_error?: string;
  error?: string;
  requests_today?: number;
  results?: FingerprintResult[];
  history?: { at: string; results: FingerprintResult[] }[];
  effective?: FingerprintPolicy;
}
