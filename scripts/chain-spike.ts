// Spike for ADR 0001: reads payments to one TESTNET address through Horizon and
// through Stellar RPC and prints both in one normalized shape.
//
//   pnpm chain:spike create-samples
//   pnpm chain:spike fetch <G...address> [--source horizon|rpc|both] [--limit 20] [--lookback 20000]
//
// Testnet only. Not used by CI or by any other script.
import { StrKey } from '@stellar/stellar-base';
import {
  fetchHorizonPayments,
  scanRpcPayments,
} from './chain-spike/clients.js';
import { loadConfig } from './chain-spike/config.js';
import { createSamples } from './chain-spike/samples.js';

function flag(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const config = loadConfig();

  if (command === 'create-samples') {
    await createSamples(config);
    return;
  }

  if (command === 'fetch') {
    const address = rest[0];
    if (!address || !StrKey.isValidEd25519PublicKey(address)) {
      throw new Error('Usage: chain:spike fetch <G... public key>');
    }
    const source = flag(rest, 'source', 'both');
    const limit = Number(flag(rest, 'limit', '20'));
    const lookback = Number(flag(rest, 'lookback', '20000'));

    if (source === 'horizon' || source === 'both') {
      const { payments, pagesRead } = await fetchHorizonPayments(
        config,
        address,
        limit,
      );
      console.log(
        `=== Horizon: ${payments.length} payments to ${address} (${pagesRead} page(s) read)`,
      );
      console.log(JSON.stringify(payments, null, 2));
    }

    if (source === 'rpc' || source === 'both') {
      const report = await scanRpcPayments(config, address, lookback);
      console.log(
        `=== RPC: ${report.payments.length} payments to ${address}\n` +
          `    retained ledgers ${report.health.oldestLedger}..${report.health.latestLedger} ` +
          `(window ${report.health.ledgerRetentionWindow}); scanned from ledger ${report.startLedger}: ` +
          `${report.transactionsScanned} transactions in ${report.pagesRead} page(s)`,
      );
      console.log(JSON.stringify(report.payments.slice(0, limit), null, 2));
    }
    return;
  }

  console.error(
    'Commands: create-samples | fetch <address> [--source horizon|rpc|both] [--limit N] [--lookback N]',
  );
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
