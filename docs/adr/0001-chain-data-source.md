# 0001. How `osl-api` reads Stellar payments

- **Status:** Proposed
- **Evidence status:** documentation research done; **the testnet runs have not been executed yet** (see [Testnet evidence](#testnet-evidence)). Claims below come from official Stellar documentation, linked inline, never from memory.

## Context

The public ledger of a project is a list of payments to that project's Stellar address: who paid (if they chose to be shown), how much, in which asset, with which memo, and when. `osl-api` must read those payments reliably, including history, and must correctly tell successful payments from failed ones. We link an off-chain supporter message to a payment through the text memo, so memos must be read exactly.

Two facts from the official docs shape the decision:

- Horizon is "nearing end-of-life and will eventually be deprecated in favor of Stellar RPC and Portfolio APIs"; it still receives protocol-compatibility updates but no new features ([APIs overview](https://developers.stellar.org/docs/data/apis)).
- Stellar RPC retains "only a bounded, recent window of history (about 7 days by default)" and describes itself as not an indexer for historical data and not a drop-in replacement for Horizon ([RPC introduction](https://developers.stellar.org/docs/data/apis/rpc)).

So neither API alone is a durable source of a **public, permanent ledger**. Whatever we pick, we need to store payments ourselves.

## Options considered

1. **Horizon only.** Use `GET /accounts/{id}/payments` with `join=transactions` and `include_failed=true`.
2. **Stellar RPC only.** Scan transactions with `getTransactions` (and possibly `getEvents`), parse the XDR, keep what concerns our addresses.
3. **Hybrid behind one interface.** Our own indexer writes normalized payments to Postgres. Live tail from Stellar RPC; deep backfill and gap repair from a Horizon instance or provider with enough retention. Both sit behind a `ChainSource` interface so either can be replaced.
4. **Run our own history source** (a Horizon instance with full history, or a Galexie data lake). Out of scope for now (see Consequences); noted as the long-term answer to retention.

## Evaluation

| Criterion                                       | Horizon                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Stellar RPC                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **List payments to one account, pagination**    | Direct: `/accounts/{id}/payments`, `order`, `cursor`, `limit` 1-200 (default 10) ([endpoint](https://developers.stellar.org/docs/data/apis/horizon/api-reference/get-payments-by-account-id)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | No per-account query. `getTransactions` pages through _all_ transactions from `startLedger` with an opaque `cursor`, `limit` 1-200 (default 50); we filter client-side ([method](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransactions)). The migration guide lists no direct equivalent for per-account operations and points to `getEvents` (CAP-67, Protocol 23, "on nodes that emit classic events") plus parsing transaction meta XDR ([guide](https://developers.stellar.org/docs/data/apis/migrate-from-horizon-to-rpc)).         |
| **How far back**                                | Public SDF Horizon was truncated to one year on 2024-08-01; third-party providers may keep more ([providers](https://developers.stellar.org/docs/data/apis/horizon/providers)). A self-run Horizon can hold full history but "is not the recommended tool for that" ([overview](https://developers.stellar.org/docs/data/apis)).                                                                                                                                                                                                                                                                                                                                                           | Default retention 120960 ledgers (about 7 days), inspectable via `getHealth` (`oldestLedger`, `latestLedger`, `ledgerRetentionWindow`) ([getEvents](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents)). `getTransactions` errors if `startLedger` is older than the node's oldest ledger ([method](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransactions)). Longer history needs a third-party archive RPC ([providers](https://developers.stellar.org/docs/data/apis/api-providers)) or our own index. |
| **Failed transactions**                         | Excluded unless `include_failed=true`; each record carries `transaction_successful` ([endpoint](https://developers.stellar.org/docs/data/apis/horizon/api-reference/get-payments-by-account-id)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Returned, with a `status` of `SUCCESS` or `FAILED` per transaction ([method](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransactions)).                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Memos, assets, amounts**                      | Operation records have `asset_type`, `asset_code`, `asset_issuer` and a decimal-string `amount`; `join=transactions` embeds the transaction (memo) ([endpoint](https://developers.stellar.org/docs/data/apis/horizon/api-reference/get-payments-by-account-id)).                                                                                                                                                                                                                                                                                                                                                                                                                           | Base64 XDR (`envelopeXdr`, `resultXdr`, `resultMetaXdr`) that we decode ourselves, for example with `@stellar/stellar-base` ([method](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getTransactions)). More work, full fidelity.                                                                                                                                                                                                                                                                                                                 |
| **Path payments, other ways to pay an account** | The payments endpoints return operation records of several types: the account-scoped example shows `create_account`, `payment` and `account_merge` ([endpoint](https://developers.stellar.org/docs/data/apis/horizon/api-reference/get-payments-by-account-id)), and the schema of the network-wide [list all payments](https://developers.stellar.org/docs/data/apis/horizon/api-reference/list-all-payments) endpoint also lists `path_payment_strict_receive` (record shape: [path payment strict receive](https://developers.stellar.org/docs/data/apis/horizon/api-reference/resources/operations/object/path-payment-strict-receive)). The account merge record shown has no amount. | Same operations are visible in the envelope; the amount actually delivered by a path payment is in the result XDR, not the envelope.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Resume after downtime**                       | Persist the last `paging_token` per address and continue with `order=asc&cursor=...`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Persist the last `cursor` or processed ledger; resuming only works while it is inside the retention window, otherwise there is a gap.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Rate limits, hosting, cost**                  | Horizon rate limits per IP address ([page](https://developers.stellar.org/docs/data/apis/horizon/api-reference/structure/rate-limiting)); public testnet endpoint `https://horizon-testnet.stellar.org` and "multiple providers" ([networks](https://developers.stellar.org/docs/networks)).                                                                                                                                                                                                                                                                                                                                                                                               | Public testnet endpoint `https://soroban-testnet.stellar.org`; for mainnet the networks page lists RPC as "third-party providers only", so a provider or self-hosting is needed ([networks](https://developers.stellar.org/docs/networks), [providers](https://developers.stellar.org/docs/data/apis/api-providers)).                                                                                                                                                                                                                                                      |
| **Finality / reorganizations**                  | Stellar's consensus protocol guarantees safety: "no two nodes ever agree on different values" ([SCP](https://developers.stellar.org/docs/learn/fundamentals/stellar-consensus-protocol)). We read this as: a closed ledger is not rolled back, so no reorg handling is needed. This is an inference, listed under Open questions.                                                                                                                                                                                                                                                                                                                                                          | Same network, same guarantee.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Summary of the trade-off

- **Horizon** is far easier for exactly our query (payments to an address, with memos and assets, already decoded) but is on a deprecation path and its public history is one year.
- **RPC** is the supported future but offers no per-account payments query, keeps about 7 days, and requires us to decode XDR and scan every transaction (cost depends on network volume; see Open questions).
- Because RPC cannot serve history and Horizon is going away, **our database must be the long-term record in both cases**. That makes the source an implementation detail behind an interface.

## Decision

Adopt **option 3, a hybrid behind a `ChainSource` interface**, with our own Postgres tables as the source of truth for the public ledger:

1. **The indexer stores payments itself**, normalized (shape below), keyed so that replays are idempotent. Reading from the API at request time is not used for the ledger.
2. **Live tail from Stellar RPC.** It is the documented direction and what stays supported. Phase 1 uses `getTransactions` plus XDR decoding, which this repo's spike already demonstrates. `getEvents` with a `to`-address topic filter would be far cheaper and should replace the scan if the open question on it is answered positively.
3. **Backfill and gap repair from Horizon** (a provider with sufficient retention, or the public endpoint for up to one year), as a replaceable adapter we expect to retire. Projects are new, so most history starts after registration and falls inside the live window while the indexer is running; backfill matters for addresses that already had a history and for outages longer than the RPC window.
4. **Retention policy:** if the indexer has been down longer than the RPC retention window, the gap is repaired from Horizon or a provider with archive access. The indexer must record the last processed ledger and refuse to silently skip a gap: it reports "history incomplete from ledger X" until it is filled.
5. **No custom node for now.** Revisit Galexie or a self-run Horizon if provider cost, limits or retention become a problem.

If maintainers prefer less moving parts, the acceptable simplification is Horizon-only for the first release behind the same interface; the interface is what protects us from the end-of-life risk either way.

## Consequences

- **Easier:** swapping sources; testing the indexer with a fake `ChainSource`; showing a complete public ledger independent of any API's retention.
- **Harder:** we own a small indexer with cursors, idempotent writes, and gap detection; two adapters to maintain at first.
- **Operations:** the indexer needs a reliable RPC endpoint (third-party provider on mainnet) and a way to monitor lag and gaps.
- **Data model implication (for a later issue):** unique key on `(txHash, opIndex)`; Horizon does not expose `opIndex` directly (see Open questions), so the first backfill adapter must reconcile identity, for example by the operation id Horizon returns.
- **Amounts** are stored and compared as decimal strings or integers in 10^-7 units, never floats.
- **Privacy:** the indexer stores public on-chain data only; redaction rules from the privacy model still apply at the API.

### Sketch of the chain-source interface (types only)

```ts
/** One operation that moved value to a watched address. */
export interface ChainPayment {
  txHash: string;
  opIndex: number | null; // null when the source cannot tell
  ledger: number;
  createdAt: string; // ISO 8601, UTC
  successful: boolean; // failed transactions are kept, but marked
  kind:
    | 'payment'
    | 'path_payment_strict_receive'
    | 'path_payment_strict_send'
    | 'create_account'
    | 'account_merge';
  from: string | null;
  to: string;
  asset: { type: 'native' } | { type: 'credit'; code: string; issuer: string };
  amount: string | null; // decimal string, up to 7 decimals
  amountExact: boolean; // false when only a bound is known
  memo:
    | { type: 'none' }
    | { type: 'text' | 'id' | 'hash' | 'return'; value: string };
}

/** Opaque position in a source, persisted between runs. */
export type ChainCursor = string;

export interface PaymentPage {
  payments: ChainPayment[];
  next: ChainCursor | null; // null when caught up
  /** Oldest ledger this source can still serve; null if unlimited or unknown. */
  oldestAvailableLedger: number | null;
}

export interface ChainSource {
  readonly name: 'rpc' | 'horizon';
  /** Payments to `address` after `cursor` (or from `fromLedger` when no cursor). */
  fetchPayments(input: {
    address: string;
    cursor?: ChainCursor;
    fromLedger?: number;
    limit: number;
  }): Promise<PaymentPage>;
  /** Latest ledger the source has seen, to measure indexer lag. */
  latestLedger(): Promise<number>;
}
```

This is the shape `scripts/chain-spike/normalize.ts` already produces (as `NormalizedPayment`, with `source` and `cursor` fields added for the experiment).

## Testnet evidence

> **Not run yet.** The script and sample-payment helper below are written and type-checked, and the parsing helpers have unit tests, but no live testnet run has been performed, so there is **no real output to show**. The acceptance item "real output from your testnet runs" is therefore still open. Run the steps below and paste the output here before accepting this ADR. The fixtures used by the unit tests are explicitly _not_ captured output: Horizon records follow the shape of the official docs example, and RPC envelopes are constructed with the SDK.

### How to reproduce

Requires Node 22 and `pnpm install`. Testnet only; keys are generated at run time, kept in memory, and never written to disk. Endpoints come from the official docs and can be overridden with `HORIZON_URL`, `STELLAR_RPC_URL` and `FRIENDBOT_URL`. The script refuses mainnet-looking URLs, is not used by CI, and is not required by any other command.

```bash
# 1. Create sample payments on testnet (funds 3 throwaway accounts through Friendbot,
#    then sends an XLM payment with a memo, an issued-asset payment with a memo,
#    and one deliberately failing payment). Prints the RECIPIENT address.
pnpm chain:spike create-samples

# 2. Read them back through Horizon and through RPC in the same normalized shape.
pnpm chain:spike fetch <RECIPIENT_ADDRESS>
pnpm chain:spike fetch <RECIPIENT_ADDRESS> --source rpc --lookback 5000
```

What to compare in the output: whether the failed payment appears and is marked unsuccessful in each source; memo and asset/issuer fidelity; amounts as 7-decimal strings; and, for RPC, how many transactions had to be scanned (`transactionsScanned`) to find a handful of payments. The testnet resets on a regular cadence ([networks](https://developers.stellar.org/docs/networks)), so old runs are not reproducible later; paste output into this ADR at the time of the run.

### Output

_To be pasted after the first run._

## Open questions

Things not verified yet. None of them is stated as fact above.

1. **Real behaviour of the spike.** All of "Testnet evidence" is pending (see above), including whether a deliberately failed transaction is returned by Horizon with `include_failed=true` and by RPC as `FAILED`.
2. **`getEvents` for payments.** Does the public testnet RPC emit CAP-67 classic payment events, and can a topic filter select events by destination address? The docs say the filters take 1-4 topic segments and at most 5 `contractIds` per request ([getEvents](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getEvents)), but the account-scoped use was not confirmed. If yes, it replaces the full transaction scan.
3. **Scan cost on mainnet.** How many transactions per ledger, and can a provider's rate limits sustain scanning all of them with `getTransactions`? Not measured.
4. **Exact rate limits and quotas** of the public Horizon and RPC endpoints and of candidate providers. The Horizon page says limits are per IP address, but the numbers were not captured.
5. **Operation identity across sources.** Horizon operation ids are not the same thing as an operation index inside a transaction. How to reconcile `(txHash, opIndex)` between the Horizon and RPC adapters is unresolved; the spike leaves `opIndex` as `null` for Horizon.
6. **Amount delivered by path payments.** The RPC path needs the result XDR to know it; the spike reports the declared amount and flags `amountExact: false` for strict-send. Horizon's record `amount` for path payments was not checked against the delivered amount on testnet.
7. **Path payments.** The account-scoped endpoint's own page does not show a path payment example, so that it returns them like the network-wide endpoint is assumed, not confirmed. The sample helper does not create one (it needs DEX liquidity), so path payments are unverified end to end.
8. **Other ways value can reach an account:** claimable balances (value arrives when claimed), Soroban contract transfers to a `G...` account, clawbacks, and muxed (`M...`) destinations. They are out of this ADR's scope and not handled by the spike.
9. **Finality.** We infer from the consensus safety guarantee that closed ledgers are never reorganized, so no reorg handling is needed. The docs page states the safety property; the operational conclusion should be confirmed (for example, whether RPC can serve a ledger that is later not final).
10. **Archive options and cost.** Third-party archive RPC providers exist ([providers](https://developers.stellar.org/docs/data/apis/api-providers)); their pricing, retention and reliability were not evaluated. Neither was self-hosting Galexie or Horizon.
11. **Portfolio APIs** are mentioned in the docs as Horizon's successor alongside RPC ([overview](https://developers.stellar.org/docs/data/apis)); they were not evaluated here.
