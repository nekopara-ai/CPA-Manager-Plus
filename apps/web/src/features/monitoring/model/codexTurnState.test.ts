import { describe, expect, it } from 'vitest';
import { resolveCodexTurnState } from './codexTurnState';

describe('resolveCodexTurnState', () => {
  it('treats a positive cache length as injected', () => {
    const state = resolveCodexTurnState({ request_length: 292, request_source: 'cache' });
    expect(state).toMatchObject({
      requestState: 'injected',
      requestLength: 292,
      requestSource: 'cache',
      hasRequest: true,
    });
  });

  it('treats a positive passthrough length as passthrough, never injected', () => {
    const state = resolveCodexTurnState({ request_length: 428, request_source: 'passthrough' });
    expect(state.requestState).toBe('passthrough');
    expect(state.requestLength).toBe(428);
  });

  it('treats an explicit none length 0 as none', () => {
    const state = resolveCodexTurnState({ request_length: 0, request_source: 'none' });
    expect(state).toMatchObject({ requestState: 'none', requestLength: 0, hasRequest: true });
  });

  it('keeps the response length without inferring a request observation', () => {
    const state = resolveCodexTurnState({ response_length: 312 });
    expect(state.requestState).toBe('unknown');
    expect(state.requestLength).toBeNull();
    expect(state.responseLength).toBe(312);
    expect(state.hasResponse).toBe(true);
  });

  it('returns unknown for missing or empty metadata', () => {
    for (const input of [undefined, null, {}]) {
      const state = resolveCodexTurnState(input);
      expect(state.requestState).toBe('unknown');
      expect(state.responseLength).toBeNull();
      expect(state.hasRequest).toBe(false);
      expect(state.hasResponse).toBe(false);
    }
  });

  it.each([
    { request_length: 0, request_source: 'cache' },
    { request_length: 292, request_source: 'none' },
    { request_length: 292 },
    { request_source: 'cache' },
    { request_length: -1, request_source: 'cache' },
    { request_length: 2.5, request_source: 'cache' },
    { request_length: 65537, request_source: 'cache' },
    { request_length: 292, request_source: 'unknown' },
  ])('rejects inconsistent or invalid request observation %#', (input) => {
    const state = resolveCodexTurnState(input);
    expect(state.requestState).toBe('unknown');
    expect(state.requestLength).toBeNull();
    expect(state.requestSource).toBeNull();
    expect(state.hasRequest).toBe(false);
  });

  it.each([0, -1, 2.5, Number.NaN])('rejects invalid response length %s', (length) => {
    const state = resolveCodexTurnState({ response_length: length });
    expect(state.responseLength).toBeNull();
    expect(state.hasResponse).toBe(false);
  });

  it('keeps a valid request alongside an invalid response length', () => {
    const state = resolveCodexTurnState({
      request_length: 292,
      request_source: 'cache',
      response_length: 0,
    });
    expect(state.requestState).toBe('injected');
    expect(state.responseLength).toBeNull();
  });

  it('defaults an omitted scope to a regular HTTP request', () => {
    const state = resolveCodexTurnState({ request_length: 292, request_source: 'cache' });
    expect(state.requestScope).toBe('http');
    expect(state.requestState).toBe('injected');
  });

  it('keeps a websocket handshake scope distinct', () => {
    const state = resolveCodexTurnState({
      request_length: 292,
      request_source: 'cache',
      request_scope: 'websocket_handshake',
    });
    expect(state.requestScope).toBe('websocket_handshake');
    expect(state.requestState).toBe('injected');
  });

  it('rejects an unsupported request scope without claiming injection', () => {
    const state = resolveCodexTurnState({
      request_length: 292,
      request_source: 'cache',
      request_scope: 'something_else',
    });
    expect(state.requestState).toBe('unknown');
    expect(state.requestScope).toBeNull();
    expect(state.hasRequest).toBe(false);
  });
});
