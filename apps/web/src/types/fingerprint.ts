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
export interface FingerprintWait {
  reason: string;
  scope: string;
  retry_at: string;
}
export interface FingerprintResult {
  deferred?: FingerprintWait;
  model: string;
  expected_model: string;
  status: string;
  prediction?: string;
  probability?: number;
  confidence?: number;
  used_outputs: number;
  parsed_numbers?: number[];
  bank_version?: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
}
export interface FingerprintSnapshot {
  enabled: boolean;
  supported?: boolean;
  results_stale?: boolean;
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
  result_policy?: FingerprintPolicy;
  model_states?: Record<
    string,
    {
      blocked: boolean;
      wait?: FingerprintWait;
      cooldown_until?: string;
      next_run_at?: string;
      last_run_at?: string;
      results_stale?: boolean;
      result?: FingerprintResult;
      result_policy?: FingerprintPolicy;
    }
  >;
  current_results?: FingerprintResult[];
  progress?: {
    started_at: string;
    model: string;
    question: number;
    attempt: number;
    completed_questions: number;
    total_questions: number;
    request_started_at: string;
    last_event_at?: string;
    received_bytes: number;
  };
  history?: { at: string; results: FingerprintResult[]; policy?: FingerprintPolicy }[];
  effective?: FingerprintPolicy;
}
