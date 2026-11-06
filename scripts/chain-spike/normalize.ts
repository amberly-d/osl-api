// Pure helpers that turn Horizon and Stellar RPC responses into one shape.
// No network access here, so they can be unit tested with fixtures.
import {
  Asset,
  FeeBumpTransaction,
  Memo,
  TransactionBuilder,
  type Operation,
  type Transaction,
} from '@stellar/stellar-base';

export type NormalizedAsset =
  { type: 'native' } | { type: 'credit'; code: string; issuer: string };

export type NormalizedMemo =
  { type: 'none' } | { type: 'text' | 'id' | 'hash' | 'return'; value: string };

export type PaymentKind =
  | 'payment'
  | 'path_payment_strict_receive'
  | 'path_payment_strict_send'
  | 'create_account'
  | 'account_merge';

/** One operation that moves value to an account, whichever API it came from. */
export interface NormalizedPayment {
  source: 'horizon' | 'rpc';
  txHash: string;
  /** Position of the operation in its transaction. `null` when the API does not expose it. */
  opIndex: number | null;
  ledger: number | null;
  /** ISO 8601, UTC. */
  createdAt: string | null;
  /** False for transactions that were included in a ledger but failed. */
  successful: boolean;
  kind: PaymentKind;
  from: string | null;
  to: string;
  asset: NormalizedAsset;
  /** Decimal string with up to 7 decimals. `null` when it is not visible in the response. */
  amount: string | null;
  /**
   * False when `amount` is only a bound, not the amount actually received
   * (path payment strict send: the minimum the sender accepts).
   */
  amountExact: boolean;
  memo: NormalizedMemo;
  /** Opaque cursor of the source API for this record, if any. */
  cursor: string | null;
}

// ---------------------------------------------------------------- Horizon

/** The subset of a Horizon operation record (with `join=transactions`) that we read. */
export interface HorizonOperationRecord {
  id: string;
  paging_token: string;
  type: string;
  transaction_successful: boolean;
  transaction_hash: string;
  created_at: string;
  source_account?: string;
  // payment and path payments
  from?: string;
  to?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
  amount?: string;
  // create_account
  funder?: string;
  account?: string;
  starting_balance?: string;
  // account_merge
  into?: string;
  transaction?: {
    ledger?: number;
    memo_type?: string;
    memo?: string;
    successful?: boolean;
  };
}

const HORIZON_KINDS: ReadonlySet<string> = new Set([
  'payment',
  'path_payment_strict_receive',
  'path_payment_strict_send',
  'create_account',
  'account_merge',
]);

function horizonAsset(record: HorizonOperationRecord): NormalizedAsset {
  if (record.asset_type === 'native' || record.asset_type === undefined) {
    return { type: 'native' };
  }
  return {
    type: 'credit',
    code: record.asset_code ?? '',
    issuer: record.asset_issuer ?? '',
  };
}

function horizonMemo(record: HorizonOperationRecord): NormalizedMemo {
  const type = record.transaction?.memo_type;
  const value = record.transaction?.memo;
  if (type === undefined || type === 'none' || value === undefined) {
    return { type: 'none' };
  }
  // Horizon returns text memos as text and the other types as strings
  // (id as a decimal string, hash and return as base64).
  if (
    type === 'text' ||
    type === 'id' ||
    type === 'hash' ||
    type === 'return'
  ) {
    return { type, value };
  }
  return { type: 'none' };
}

/**
 * Normalizes one Horizon operation record. Returns `null` for operations that
 * are not a value transfer (or that are not addressed to `address`).
 *
 * Account merges carry no amount in the record, so `amount` is `null`.
 */
export function normalizeHorizonRecord(
  record: HorizonOperationRecord,
  address: string,
): NormalizedPayment | null {
  if (!HORIZON_KINDS.has(record.type)) return null;
  const kind = record.type as PaymentKind;

  let from: string | null;
  let to: string | undefined;
  let amount: string | null;
  let asset: NormalizedAsset = horizonAsset(record);

  switch (kind) {
    case 'create_account':
      from = record.funder ?? null;
      to = record.account;
      amount = record.starting_balance ?? null;
      asset = { type: 'native' };
      break;
    case 'account_merge':
      from = record.account ?? null;
      to = record.into;
      amount = null;
      asset = { type: 'native' };
      break;
    default:
      from = record.from ?? null;
      to = record.to;
      amount = record.amount ?? null;
  }

  if (to !== address) return null;

  return {
    source: 'horizon',
    txHash: record.transaction_hash,
    opIndex: null,
    ledger: record.transaction?.ledger ?? null,
    createdAt: record.created_at,
    successful: record.transaction_successful,
    kind,
    from,
    to,
    asset,
    amount,
    amountExact: true,
    memo: horizonMemo(record),
    cursor: record.paging_token,
  };
}

// ---------------------------------------------------------------- RPC

/** The subset of a Stellar RPC `getTransactions` entry that we read (base64 XDR format). */
export interface RpcTransaction {
  status: 'SUCCESS' | 'FAILED' | string;
  txHash: string;
  ledger: number;
  createdAt: string | number;
  envelopeXdr: string;
}

function rpcAsset(asset: Asset): NormalizedAsset {
  return asset.isNative()
    ? { type: 'native' }
    : { type: 'credit', code: asset.getCode(), issuer: asset.getIssuer() };
}

function rpcMemo(memo: Memo): NormalizedMemo {
  switch (memo.type) {
    case 'text':
      return { type: 'text', value: String(memo.value) };
    case 'id':
      return { type: 'id', value: String(memo.value) };
    case 'hash':
    case 'return':
      return {
        type: memo.type,
        value: Buffer.from(memo.value as Uint8Array).toString('hex'),
      };
    default:
      return { type: 'none' };
  }
}

function toIso(value: string | number): string | null {
  const seconds = Number(value);
  return Number.isFinite(seconds)
    ? new Date(seconds * 1000).toISOString()
    : null;
}

/**
 * Extracts every operation in an RPC transaction that pays `address`, by
 * parsing the transaction envelope. RPC has no per-account query, so callers
 * must page through all transactions and filter like this.
 *
 * Limits of this spike: amounts of path payments are the declared amounts, not
 * the amounts actually delivered (those are in the result XDR, which is not
 * parsed here), and muxed (M...) destinations are not matched.
 */
export function normalizeRpcTransaction(
  tx: RpcTransaction,
  address: string,
  networkPassphrase: string,
): NormalizedPayment[] {
  const parsed = TransactionBuilder.fromXDR(tx.envelopeXdr, networkPassphrase);
  const inner: Transaction =
    parsed instanceof FeeBumpTransaction ? parsed.innerTransaction : parsed;

  const out: NormalizedPayment[] = [];
  inner.operations.forEach((op: Operation, index: number) => {
    const base = {
      source: 'rpc' as const,
      txHash: tx.txHash,
      opIndex: index,
      ledger: tx.ledger,
      createdAt: toIso(tx.createdAt),
      successful: tx.status === 'SUCCESS',
      memo: rpcMemo(inner.memo),
      cursor: null,
    };
    const opSource = op.source ?? inner.source;

    switch (op.type) {
      case 'payment':
        if (op.destination === address) {
          out.push({
            ...base,
            kind: 'payment',
            from: opSource,
            to: op.destination,
            asset: rpcAsset(op.asset),
            amount: op.amount,
            amountExact: true,
          });
        }
        break;
      case 'pathPaymentStrictReceive':
        if (op.destination === address) {
          out.push({
            ...base,
            kind: 'path_payment_strict_receive',
            from: opSource,
            to: op.destination,
            asset: rpcAsset(op.destAsset),
            amount: op.destAmount,
            amountExact: true,
          });
        }
        break;
      case 'pathPaymentStrictSend':
        if (op.destination === address) {
          out.push({
            ...base,
            kind: 'path_payment_strict_send',
            from: opSource,
            to: op.destination,
            asset: rpcAsset(op.destAsset),
            amount: op.destMin,
            amountExact: false,
          });
        }
        break;
      case 'createAccount':
        if (op.destination === address) {
          out.push({
            ...base,
            kind: 'create_account',
            from: opSource,
            to: op.destination,
            asset: { type: 'native' },
            amount: op.startingBalance,
            amountExact: true,
          });
        }
        break;
      case 'accountMerge':
        if (op.destination === address) {
          out.push({
            ...base,
            kind: 'account_merge',
            from: opSource,
            to: op.destination,
            asset: { type: 'native' },
            amount: null,
            amountExact: false,
          });
        }
        break;
      default:
        break;
    }
  });
  return out;
}
