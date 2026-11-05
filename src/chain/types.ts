export type StellarNetwork = 'testnet' | 'mainnet';

/**
 * Lifecycle of a payment read from the Stellar network.
 *
 * Transitions between statuses are intentionally out of scope here.
 */
export type PaymentStatus =
  /** Seen in a submitted transaction, not yet confirmed on-chain. */
  | 'pending'
  /** Included in a closed ledger and matched to a project. */
  | 'confirmed'
  /** The transaction failed on-chain and no funds moved. */
  | 'failed'
  /** The transaction or its shape could not be validated. */
  | 'invalid'
  /** Already counted under another transaction or payment id. */
  | 'duplicate'
  /** The asset is not XLM or official USDC for this network. */
  | 'unsupported_asset';

/**
 * A Stellar asset. `issuer: null` means the native asset, XLM.
 *
 * For issued assets the code alone is not enough: anyone can issue a token
 * called USDC, so the issuer is part of the identity.
 */
export interface AssetRef {
  readonly code: string;
  readonly issuer: string | null;
}
