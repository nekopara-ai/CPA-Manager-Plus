import { describe, expect, it } from 'vitest';
import { parseDocument, parse } from 'yaml';
import { applyMintConfig, parseMintConfig, validateMintConfig } from './gatewayMintConfig';
import { EMPTY_MINT_CONFIG, MINT_KEYS, MINT_NUMBERS } from '@/types/gatewayMintConfig';
import { gatewayMintEn, gatewayMintZhCN, gatewayMintZhTW, gatewayMintRu } from '@/i18n/gatewayMint';

const source = `# Keep unrelated configuration
proxy-url: http://example.invalid
codex:
  identity-confuse: true
  turn-ticket:
    enabled: false # keep this comment
    mint-ticket-length: 0
    require-model-match: false
    future-option: keep-me
    models: [A, B]
    auth-ids: [credential-id]
`;
describe('gateway mint YAML editor', () => {
  it('preserves absence, explicit false and explicit zero as three distinct values', () => {
    const values = parseMintConfig(parse(source).codex);
    expect(values.enabled).toBe('false');
    expect(values['mint-ticket-length']).toBe('0');
    expect(values['gateway-mint']).toBe('');
    const doc = parseDocument(source);
    applyMintConfig(doc, values, () => false);
    expect(doc.toString()).toContain('mint-ticket-length: 0');
  });
  it('updates only the dirty keys and preserves scopes, legacy fields, future options and comments', () => {
    const doc = parseDocument(source);
    const values = { ...parseMintConfig(parse(source).codex), enabled: 'true' };
    applyMintConfig(doc, values, (key) => key === 'codexTurnTicket.enabled');
    expect(doc.toString()).toContain('# keep this comment');
    expect(doc.toJS()).toMatchObject({
      'proxy-url': 'http://example.invalid',
      codex: {
        'identity-confuse': true,
        'turn-ticket': {
          enabled: true,
          'mint-ticket-length': 0,
          'require-model-match': false,
          'future-option': 'keep-me',
          models: ['A', 'B'],
          'auth-ids': ['credential-id'],
        },
      },
    });
    expect(doc.hasIn(['codex', 'turn-ticket', 'gateway-mint'])).toBe(false);
  });
  it('clears an explicit length back to inheritance without writing zero', () => {
    const doc = parseDocument(source);
    applyMintConfig(
      doc,
      { ...parseMintConfig(parse(source).codex), 'mint-ticket-length': '' },
      (key) => key.endsWith('mint-ticket-length')
    );
    expect(doc.hasIn(['codex', 'turn-ticket', 'mint-ticket-length'])).toBe(false);
  });
  it('roundtrips explicit false and zero when newly set on default-inheriting keys', () => {
    const doc = parseDocument('other: keep');
    const values = {
      ...EMPTY_MINT_CONFIG,
      'injection-enabled': 'false',
      'mint-ticket-length': '0',
      'mint-transports': 'sse\nwebsocket',
    };
    applyMintConfig(doc, values, (key) =>
      ['injection-enabled', 'mint-ticket-length', 'mint-transports'].some((end) =>
        key.endsWith(end)
      )
    );
    expect(doc.toJS()).toMatchObject({
      other: 'keep',
      codex: {
        'turn-ticket': {
          'injection-enabled': false,
          'mint-ticket-length': 0,
          'mint-transports': ['sse', 'websocket'],
        },
      },
    });
  });
  it('validates backend limits instead of accepting overflow or silently coercing fractions', () => {
    for (const [key, [, max]] of Object.entries(MINT_NUMBERS)) {
      expect(validateMintConfig({ ...EMPTY_MINT_CONFIG, [key]: String(max) })).toEqual({});
      for (const value of ['-1', '1.5', 'NaN', '99999999999999999999', String(max + 1)]) {
        expect(validateMintConfig({ ...EMPTY_MINT_CONFIG, [key]: value })).toHaveProperty(
          `codexTurnTicket.${key}`
        );
      }
    }
    expect(validateMintConfig({ ...EMPTY_MINT_CONFIG, 'mint-transports': 'ws' })).toHaveProperty(
      'codexTurnTicket.mint-transports'
    );
    expect(validateMintConfig({ ...EMPTY_MINT_CONFIG, 'mint-gateway': 'x\n' })).toHaveProperty(
      'codexTurnTicket.mint-gateway'
    );
  });
  it('rejects malformed source mappings and empty explicit transports', () => {
    expect(() => parseMintConfig({ 'turn-ticket': 'invalid' })).toThrow();
    expect(() => parseMintConfig({ 'turn-ticket': { 'mint-transports': [] } })).toThrow();
    expect(() => parseMintConfig({ 'turn-ticket': { enabled: 'false' } })).toThrow();
  });
  it('does not overwrite a scalar or shared YAML alias mapping', () => {
    const doc = parseDocument(
      'original: &shared { enabled: true }\ncodex: { turn-ticket: *shared }'
    );
    expect(() =>
      applyMintConfig(doc, { ...EMPTY_MINT_CONFIG, enabled: 'false' }, () => true)
    ).toThrow();
    expect(doc.toString()).toContain('*shared');
  });
  it('provides every new control and status label in all supported languages', () => {
    for (const locale of [gatewayMintZhCN, gatewayMintZhTW, gatewayMintRu])
      expect(Object.keys(locale).sort()).toEqual(Object.keys(gatewayMintEn).sort());
    for (const key of MINT_KEYS)
      expect(gatewayMintEn).toHaveProperty(`config_${key.replace(/-/g, '_')}`);
  });
});
