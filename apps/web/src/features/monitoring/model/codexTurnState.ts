/**
 * Codex X-Codex-Turn-State request/response observation presentation.
 *
 * The backend keeps the request observation (what this attempt sent) and the
 * response observation (what the upstream returned) independent. A response
 * length never proves that a ticket was injected, so the badge only claims
 * injection when an explicit, internally consistent request observation exists.
 */
const MAX_CODEX_REQUEST_TICKET_LENGTH = 64 * 1024;

export type CodexTurnStateRequestSource = 'cache' | 'passthrough' | 'none';

export type CodexTurnStateRequestScope = 'http' | 'websocket_handshake';

export type CodexTurnStateRequestState = 'injected' | 'passthrough' | 'none' | 'unknown';

export interface CodexTurnStateInput {
  request_length?: unknown;
  request_source?: unknown;
  request_scope?: unknown;
  response_length?: unknown;
}

export interface CodexTurnStateObservation {
  /** Resolved request badge state; `unknown` means no usable request observation. */
  requestState: CodexTurnStateRequestState;
  /** Verified request ticket length, or null when the observation is unusable. */
  requestLength: number | null;
  /** Verified request source, or null when the observation is unusable. */
  requestSource: CodexTurnStateRequestSource | null;
  /**
   * Verified request scope. Omitted scope means a regular HTTP request; an
   * unsupported scope leaves this null and suppresses the request badge claim.
   */
  requestScope: CodexTurnStateRequestScope | null;
  /** Verified response ticket length, present even for legacy response-only rows. */
  responseLength: number | null;
  hasRequest: boolean;
  hasResponse: boolean;
}

const normalizeRequestSource = (value: unknown): CodexTurnStateRequestSource | null => {
  if (value === 'cache' || value === 'passthrough' || value === 'none') return value;
  return null;
};

const normalizeRequestScope = (value: unknown): CodexTurnStateRequestScope | null => {
  if (value === undefined || value === null || value === '') return 'http';
  if (value === 'websocket_handshake') return 'websocket_handshake';
  return null;
};

const isCandidateLength = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const isConsistentRequestLength = (
  source: CodexTurnStateRequestSource,
  length: number
): boolean => {
  if (length > MAX_CODEX_REQUEST_TICKET_LENGTH) return false;
  if (source === 'none') return length === 0;
  return length > 0;
};

const resolveResponseLength = (value: unknown): number | null =>
  isCandidateLength(value) && value > 0 ? value : null;

export const resolveCodexTurnState = (
  state: CodexTurnStateInput | null | undefined
): CodexTurnStateObservation => {
  const responseLength = resolveResponseLength(state?.response_length);

  const requestSource = normalizeRequestSource(state?.request_source);
  const requestScope = normalizeRequestScope(state?.request_scope);
  const requestLength = isCandidateLength(state?.request_length) ? state.request_length : null;
  const hasRequest =
    requestSource !== null &&
    requestScope !== null &&
    requestLength !== null &&
    isConsistentRequestLength(requestSource, requestLength);

  if (!hasRequest) {
    return {
      requestState: 'unknown',
      requestLength: null,
      requestSource: null,
      requestScope: null,
      responseLength,
      hasRequest: false,
      hasResponse: responseLength !== null,
    };
  }

  const requestState: CodexTurnStateRequestState =
    requestSource === 'cache'
      ? 'injected'
      : requestSource === 'passthrough'
        ? 'passthrough'
        : 'none';

  return {
    requestState,
    requestLength,
    requestSource,
    requestScope,
    responseLength,
    hasRequest: true,
    hasResponse: responseLength !== null,
  };
};
