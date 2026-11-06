// Creates sample TESTNET payments so a reviewer can reproduce the evidence.
// All keys are generated here, kept in memory and never written to disk. Only
// public keys are printed. Never put a real secret key anywhere near this file.
import {
  Account,
  Asset,
  Keypair,
  Memo,
  Operation,
  TransactionBuilder,
  type Transaction,
} from '@stellar/stellar-base';
import type { SpikeConfig } from './config.js';

const ASSET_CODE = 'OSLTEST';

async function fund(config: SpikeConfig, publicKey: string): Promise<void> {
  const response = await fetch(
    `${config.friendbotUrl}?addr=${encodeURIComponent(publicKey)}`,
  );
  if (!response.ok) {
    throw new Error(
      `Friendbot failed for ${publicKey}: ${response.status} ${await response.text()}`,
    );
  }
}

async function loadAccount(
  config: SpikeConfig,
  publicKey: string,
): Promise<Account> {
  const response = await fetch(`${config.horizonUrl}/accounts/${publicKey}`);
  if (!response.ok) {
    throw new Error(
      `Could not load ${publicKey}: ${response.status} ${await response.text()}`,
    );
  }
  const body = (await response.json()) as { sequence: string };
  return new Account(publicKey, body.sequence);
}

interface SubmitResult {
  ok: boolean;
  hash?: string;
  detail: string;
}

/** Submits through Horizon's POST /transactions (form-encoded `tx`). */
async function submit(
  config: SpikeConfig,
  tx: Transaction,
): Promise<SubmitResult> {
  const response = await fetch(`${config.horizonUrl}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tx: tx.toEnvelope().toXDR('base64') }),
  });
  const body = (await response.json()) as {
    hash?: string;
    extras?: { result_codes?: unknown };
    title?: string;
  };
  return {
    ok: response.ok,
    hash: body.hash ?? tx.hash().toString('hex'),
    detail: response.ok
      ? 'applied'
      : `${body.title ?? response.status} ${JSON.stringify(body.extras?.result_codes ?? {})}`,
  };
}

function build(
  config: SpikeConfig,
  source: Account,
  operation: ReturnType<typeof Operation.payment>,
  signer: Keypair,
  memo?: Memo,
): Transaction {
  const builder = new TransactionBuilder(source, {
    fee: '1000',
    networkPassphrase: config.networkPassphrase,
  }).addOperation(operation);
  if (memo) builder.addMemo(memo);
  const tx = builder.setTimeout(60).build();
  tx.sign(signer);
  return tx;
}

export async function createSamples(config: SpikeConfig): Promise<void> {
  const issuer = Keypair.random();
  const recipient = Keypair.random();
  const sender = Keypair.random();
  const asset = new Asset(ASSET_CODE, issuer.publicKey());

  console.log('Throwaway testnet accounts (keys are not saved):');
  console.log(`  issuer    ${issuer.publicKey()}`);
  console.log(`  sender    ${sender.publicKey()}`);
  console.log(
    `  RECIPIENT ${recipient.publicKey()}   <- payments below are sent here\n`,
  );

  for (const key of [issuer, recipient, sender])
    await fund(config, key.publicKey());

  const issuerAccount = await loadAccount(config, issuer.publicKey());
  const recipientAccount = await loadAccount(config, recipient.publicKey());
  const senderAccount = await loadAccount(config, sender.publicKey());

  const steps: { label: string; tx: Transaction }[] = [
    {
      label: 'recipient trusts the sample asset',
      tx: build(
        config,
        recipientAccount,
        Operation.changeTrust({ asset }),
        recipient,
      ),
    },
    {
      label: 'XLM payment with a text memo',
      tx: build(
        config,
        senderAccount,
        Operation.payment({
          destination: recipient.publicKey(),
          asset: Asset.native(),
          amount: '12.3456789',
        }),
        sender,
        Memo.text('osl-sample-xlm'),
      ),
    },
    {
      label: `issued asset (${ASSET_CODE}) payment with a text memo`,
      tx: build(
        config,
        issuerAccount,
        Operation.payment({
          destination: recipient.publicKey(),
          asset,
          amount: '25.5',
        }),
        issuer,
        Memo.text('osl-sample-asset'),
      ),
    },
    {
      // Valid and fee-paying, but the amount exceeds the balance, so the
      // operation fails when applied. Horizon is expected to answer with an
      // HTTP error (tx_failed) for this step, so ERROR here is the intended
      // outcome. Whether the failed transaction is then visible through each
      // API is exactly what the ADR evaluates.
      label: 'FAILED payment (underfunded), recorded on-chain',
      tx: build(
        config,
        senderAccount,
        Operation.payment({
          destination: recipient.publicKey(),
          asset: Asset.native(),
          amount: '900000000',
        }),
        sender,
        Memo.text('osl-sample-failed'),
      ),
    },
  ];

  for (const { label, tx } of steps) {
    const result = await submit(config, tx);
    console.log(
      `${result.ok ? 'OK   ' : 'ERROR'} ${label}\n       hash ${result.hash}  ${result.detail}`,
    );
  }

  console.log(
    '\nNote: path payments are not created here (they need DEX liquidity); see the ADR open questions.',
  );
  console.log(`\nNow run:\n  pnpm chain:spike fetch ${recipient.publicKey()}`);
}
