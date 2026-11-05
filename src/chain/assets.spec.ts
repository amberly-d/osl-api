import {
  getSupportedAssets,
  isSupportedAsset,
  USDC_MAINNET,
  USDC_TESTNET,
  XLM,
} from './index.js';

describe('supported assets', () => {
  it('accepts XLM on both networks', () => {
    expect(isSupportedAsset('testnet', XLM)).toBe(true);
    expect(isSupportedAsset('mainnet', XLM)).toBe(true);
  });

  it('accepts official USDC for the matching network', () => {
    expect(isSupportedAsset('testnet', USDC_TESTNET)).toBe(true);
    expect(isSupportedAsset('mainnet', USDC_MAINNET)).toBe(true);
  });

  it('rejects USDC from another issuer', () => {
    expect(
      isSupportedAsset('mainnet', {
        code: 'USDC',
        issuer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      }),
    ).toBe(false);
  });

  it('rejects the other network issuer', () => {
    expect(isSupportedAsset('testnet', USDC_MAINNET)).toBe(false);
    expect(isSupportedAsset('mainnet', USDC_TESTNET)).toBe(false);
  });

  it('matches casing exactly', () => {
    expect(
      isSupportedAsset('mainnet', {
        code: 'usdc',
        issuer: USDC_MAINNET.issuer,
      }),
    ).toBe(false);
    expect(
      isSupportedAsset('mainnet', {
        code: 'XLM',
        issuer: null,
      }),
    ).toBe(true);
    expect(
      isSupportedAsset('mainnet', {
        code: 'xlm',
        issuer: null,
      }),
    ).toBe(false);
  });

  it('rejects a native asset that claims an issuer', () => {
    expect(
      isSupportedAsset('mainnet', {
        code: 'XLM',
        issuer: USDC_MAINNET.issuer,
      }),
    ).toBe(false);
  });

  it('rejects an unrelated asset', () => {
    expect(
      isSupportedAsset('mainnet', {
        code: 'EURC',
        issuer: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
      }),
    ).toBe(false);
  });

  it('returns the supported assets per network', () => {
    expect(getSupportedAssets('testnet')).toEqual([XLM, USDC_TESTNET]);
    expect(getSupportedAssets('mainnet')).toEqual([XLM, USDC_MAINNET]);
    expect(getSupportedAssets('mainnet')).toHaveLength(2);
  });

  it('exposes immutable asset data', () => {
    expect(Object.isFrozen(XLM)).toBe(true);
    expect(Object.isFrozen(getSupportedAssets('mainnet'))).toBe(true);
  });
});
