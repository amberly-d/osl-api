// NOT CAPTURED FROM A LIVE RUN. These records follow the response shape in the
// official Horizon docs example for "Retrieve an Account's Payments" (with
// `join=transactions`), using made-up values and throwaway addresses. Replace
// them with real captured output once `pnpm chain:spike fetch` has been run.
// https://developers.stellar.org/docs/data/apis/horizon/api-reference/get-payments-by-account-id
import type { HorizonOperationRecord } from '../normalize.js';

export const TARGET =
  'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7';
export const SENDER =
  'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO';
export const ISSUER =
  'GCRCUE2C5TBNIPYHMEP7NK5RWTT2WBSZ75CMARH7GDOHDDCQH3XANFOB';

const tx = (overrides: Record<string, unknown> = {}) => ({
  ledger: 1234,
  memo_type: 'text',
  memo: 'osl-ref-1',
  successful: true,
  ...overrides,
});

export const nativePayment: HorizonOperationRecord = {
  id: '1',
  paging_token: '1',
  type: 'payment',
  transaction_successful: true,
  transaction_hash: 'a'.repeat(64),
  created_at: '2026-01-01T00:00:00Z',
  from: SENDER,
  to: TARGET,
  asset_type: 'native',
  amount: '10.0000000',
  transaction: tx(),
};

export const issuedPayment: HorizonOperationRecord = {
  ...nativePayment,
  id: '2',
  paging_token: '2',
  asset_type: 'credit_alphanum4',
  asset_code: 'USDC',
  asset_issuer: ISSUER,
  amount: '0.0000001',
  transaction: tx({ memo_type: 'none', memo: undefined }),
};

export const failedPayment: HorizonOperationRecord = {
  ...nativePayment,
  id: '3',
  paging_token: '3',
  transaction_successful: false,
  transaction: tx({ successful: false }),
};

export const pathPayment: HorizonOperationRecord = {
  ...issuedPayment,
  id: '4',
  paging_token: '4',
  type: 'path_payment_strict_receive',
};

export const createAccount: HorizonOperationRecord = {
  id: '5',
  paging_token: '5',
  type: 'create_account',
  transaction_successful: true,
  transaction_hash: 'b'.repeat(64),
  created_at: '2026-01-01T00:00:00Z',
  funder: SENDER,
  account: TARGET,
  starting_balance: '1.0000000',
  transaction: tx({ memo_type: 'none', memo: undefined }),
};

export const accountMerge: HorizonOperationRecord = {
  id: '6',
  paging_token: '6',
  type: 'account_merge',
  transaction_successful: true,
  transaction_hash: 'c'.repeat(64),
  created_at: '2026-01-01T00:00:00Z',
  account: SENDER,
  into: TARGET,
  transaction: tx({ memo_type: 'none', memo: undefined }),
};

/** Sent BY the target, not to it. */
export const outgoing: HorizonOperationRecord = {
  ...nativePayment,
  id: '7',
  paging_token: '7',
  from: TARGET,
  to: SENDER,
};

export const changeTrust: HorizonOperationRecord = {
  id: '8',
  paging_token: '8',
  type: 'change_trust',
  transaction_successful: true,
  transaction_hash: 'd'.repeat(64),
  created_at: '2026-01-01T00:00:00Z',
};
