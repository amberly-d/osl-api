import type { AssetRef, StellarNetwork } from './types.js';

// Issuers below come from Circle's official USDC contract-address table:
// https://developers.circle.com/stablecoins/usdc-contract-addresses
// Do not replace them with values from blogs, explorers or other repositories.
const USDC_MAINNET_ISSUER =
  'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
const USDC_TESTNET_ISSUER =
  'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export const XLM: AssetRef = Object.freeze({
  code: 'XLM',
  issuer: null,
});

export const USDC_MAINNET: AssetRef = Object.freeze({
  code: 'USDC',
  issuer: USDC_MAINNET_ISSUER,
});

export const USDC_TESTNET: AssetRef = Object.freeze({
  code: 'USDC',
  issuer: USDC_TESTNET_ISSUER,
});

const SUPPORTED_ASSETS: Readonly<Record<StellarNetwork, readonly AssetRef[]>> =
  Object.freeze({
    testnet: Object.freeze([XLM, USDC_TESTNET]),
    mainnet: Object.freeze([XLM, USDC_MAINNET]),
  });

/** The supported assets for a network, in review-friendly order. */
export function getSupportedAssets(
  network: StellarNetwork,
): readonly AssetRef[] {
  return SUPPORTED_ASSETS[network];
}

/**
 * Exact matching on code and issuer. A native asset with an issuer is not XLM,
 * and a different issuer is not official USDC.
 */
export function isSupportedAsset(
  network: StellarNetwork,
  asset: AssetRef,
): boolean {
  const supported = SUPPORTED_ASSETS[network];
  if (!supported) {
    return false;
  }

  return supported.some(
    (candidate) =>
      candidate.code === asset.code && candidate.issuer === asset.issuer,
  );
}
