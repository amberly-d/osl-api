// Thin network clients for the spike. Kept separate from normalize.ts so the
// parsing logic stays pure and unit-testable. Nothing here runs in CI.
import type { SpikeConfig } from './config.js';
import {
  normalizeHorizonRecord,
  normalizeRpcTransaction,
  type HorizonOperationRecord,
  type NormalizedPayment,
  type RpcTransaction,
} from './normalize.js';

const PAGE_LIMIT = 200; // documented maximum for both Horizon and RPC page sizes

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(
      `GET ${url} failed: ${response.status} ${await response.text()}`,
    );
  }
  return (await response.json()) as T;
}

async function rpc<T>(
  config: SpikeConfig,
  method: string,
  params?: unknown,
): Promise<T> {
  const response = await fetch(config.rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(
      `RPC ${method} failed: ${response.status} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as {
    result?: T;
    error?: { code: number; message: string };
  };
  if (body.error) {
    throw new Error(
      `RPC ${method} error ${body.error.code}: ${body.error.message}`,
    );
  }
  return body.result as T;
}

// ---------------------------------------------------------------- Horizon

interface HorizonPage {
  _links: { next?: { href: string } };
  _embedded: { records: HorizonOperationRecord[] };
}

/**
 * Newest-first payments to `address` from
 * `GET /accounts/{id}/payments?join=transactions&include_failed=true`, following
 * the `next` link until `limit` incoming payments are collected, the history
 * ends, or `maxPages` pages were read.
 */
export async function fetchHorizonPayments(
  config: SpikeConfig,
  address: string,
  limit: number,
  maxPages = 10,
): Promise<{ payments: NormalizedPayment[]; pagesRead: number }> {
  let url =
    `${config.horizonUrl}/accounts/${address}/payments` +
    `?order=desc&limit=${PAGE_LIMIT}&join=transactions&include_failed=true`;
  const payments: NormalizedPayment[] = [];
  let pagesRead = 0;

  while (pagesRead < maxPages && payments.length < limit) {
    const page = await getJson<HorizonPage>(url);
    pagesRead += 1;
    const records = page._embedded.records;
    if (records.length === 0) break;

    for (const record of records) {
      const payment = normalizeHorizonRecord(record, address);
      if (payment) payments.push(payment);
    }
    const next = page._links.next?.href;
    if (!next) break;
    url = next;
  }
  return { payments: payments.slice(0, limit), pagesRead };
}

// ---------------------------------------------------------------- RPC

interface RpcHealth {
  status: string;
  latestLedger: number;
  oldestLedger: number;
  ledgerRetentionWindow: number;
}

interface RpcTransactionsResult {
  transactions: RpcTransaction[];
  latestLedger: number;
  oldestLedger: number;
  cursor?: string;
}

export interface RpcScanReport {
  payments: NormalizedPayment[];
  health: RpcHealth;
  startLedger: number;
  transactionsScanned: number;
  pagesRead: number;
}

/**
 * RPC has no per-account payment query, so this scans every transaction from
 * `latest - lookbackLedgers` (not before the node's oldest retained ledger)
 * with `getTransactions` and filters client-side. The report shows how much had
 * to be scanned, which is the cost of this approach.
 */
export async function scanRpcPayments(
  config: SpikeConfig,
  address: string,
  lookbackLedgers: number,
  maxPages = 50,
): Promise<RpcScanReport> {
  const health = await rpc<RpcHealth>(config, 'getHealth');
  const startLedger = Math.max(
    health.oldestLedger,
    health.latestLedger - lookbackLedgers,
  );

  const payments: NormalizedPayment[] = [];
  let transactionsScanned = 0;
  let pagesRead = 0;
  let cursor: string | undefined;

  while (pagesRead < maxPages) {
    // `startLedger` must be omitted when a cursor is given (RPC docs).
    const params = cursor
      ? { pagination: { cursor, limit: PAGE_LIMIT } }
      : { startLedger, pagination: { limit: PAGE_LIMIT } };
    const result = await rpc<RpcTransactionsResult>(
      config,
      'getTransactions',
      params,
    );
    pagesRead += 1;

    for (const tx of result.transactions) {
      transactionsScanned += 1;
      payments.push(
        ...normalizeRpcTransaction(tx, address, config.networkPassphrase),
      );
    }
    if (result.transactions.length < PAGE_LIMIT || !result.cursor) break;
    cursor = result.cursor;
  }

  // Newest first, to match the Horizon output.
  payments.sort(
    (a, b) =>
      (b.ledger ?? 0) - (a.ledger ?? 0) || (b.opIndex ?? 0) - (a.opIndex ?? 0),
  );
  return { payments, health, startLedger, transactionsScanned, pagesRead };
}
