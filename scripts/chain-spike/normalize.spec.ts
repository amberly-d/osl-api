import {
  Account,
  Asset,
  Keypair,
  Memo,
  Networks,
  Operation,
  TransactionBuilder,
} from '@stellar/stellar-base';
import { describe, expect, it } from 'vitest';
import * as horizon from './fixtures/horizon-payments.fixture.js';
import {
  normalizeHorizonRecord,
  normalizeRpcTransaction,
  type RpcTransaction,
} from './normalize.js';

describe('normalizeHorizonRecord', () => {
  const normalize = (record: Parameters<typeof normalizeHorizonRecord>[0]) =>
    normalizeHorizonRecord(record, horizon.TARGET);

  it('normalizes a native payment with a text memo', () => {
    expect(normalize(horizon.nativePayment)).toEqual({
      source: 'horizon',
      txHash: 'a'.repeat(64),
      opIndex: null,
      ledger: 1234,
      createdAt: '2026-01-01T00:00:00Z',
      successful: true,
      kind: 'payment',
      from: horizon.SENDER,
      to: horizon.TARGET,
      asset: { type: 'native' },
      amount: '10.0000000',
      amountExact: true,
      memo: { type: 'text', value: 'osl-ref-1' },
      cursor: '1',
    });
  });

  it('keeps the asset issuer and 7-decimal amounts as strings', () => {
    const payment = normalize(horizon.issuedPayment);
    expect(payment?.asset).toEqual({
      type: 'credit',
      code: 'USDC',
      issuer: horizon.ISSUER,
    });
    expect(payment?.amount).toBe('0.0000001');
    expect(payment?.memo).toEqual({ type: 'none' });
  });

  it('marks failed transactions as unsuccessful', () => {
    expect(normalize(horizon.failedPayment)?.successful).toBe(false);
  });

  it('handles path payments, create_account and account_merge', () => {
    expect(normalize(horizon.pathPayment)?.kind).toBe(
      'path_payment_strict_receive',
    );
    expect(normalize(horizon.createAccount)).toMatchObject({
      kind: 'create_account',
      from: horizon.SENDER,
      amount: '1.0000000',
      asset: { type: 'native' },
    });
    expect(normalize(horizon.accountMerge)).toMatchObject({
      kind: 'account_merge',
      amount: null,
      amountExact: true,
    });
  });

  it('ignores payments sent by the account and non-payment operations', () => {
    expect(normalize(horizon.outgoing)).toBeNull();
    expect(normalize(horizon.changeTrust)).toBeNull();
  });
});

// RPC fixtures are CONSTRUCTED with the SDK (deterministic), not captured from
// a live node. Real captured responses should replace them after a testnet run.
describe('normalizeRpcTransaction', () => {
  const passphrase = Networks.TESTNET;
  const source = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
  const target = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2)).publicKey();
  const other = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 3)).publicKey();
  const issuer = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 4)).publicKey();

  function build(
    operations: ReturnType<typeof Operation.payment>[],
    memo?: Memo,
  ) {
    const builder = new TransactionBuilder(
      new Account(source.publicKey(), '1'),
      {
        fee: '100',
        networkPassphrase: passphrase,
      },
    );
    operations.forEach((op) => builder.addOperation(op));
    if (memo) builder.addMemo(memo);
    const tx = builder.setTimeout(0).build();
    tx.sign(source);
    return tx;
  }

  const rpc = (
    envelopeXdr: string,
    status: RpcTransaction['status'] = 'SUCCESS',
  ): RpcTransaction => ({
    status,
    txHash: 'f'.repeat(64),
    ledger: 99,
    createdAt: '1767225600', // 2026-01-01T00:00:00Z
    envelopeXdr,
  });

  it('extracts payments to the address with memo and operation index', () => {
    const tx = build(
      [
        Operation.payment({
          destination: other,
          asset: Asset.native(),
          amount: '1',
        }),
        Operation.payment({
          destination: target,
          asset: new Asset('USDC', issuer),
          amount: '12.3456789',
        }),
      ],
      Memo.text('ref-42'),
    );

    const payments = normalizeRpcTransaction(
      rpc(tx.toEnvelope().toXDR('base64')),
      target,
      passphrase,
    );

    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({
      source: 'rpc',
      opIndex: 1,
      ledger: 99,
      createdAt: '2026-01-01T00:00:00.000Z',
      successful: true,
      kind: 'payment',
      from: source.publicKey(),
      to: target,
      asset: { type: 'credit', code: 'USDC', issuer },
      amount: '12.3456789',
      amountExact: true,
      memo: { type: 'text', value: 'ref-42' },
    });
  });

  it('reports failed transactions as unsuccessful', () => {
    const tx = build([
      Operation.payment({
        destination: target,
        asset: Asset.native(),
        amount: '5',
      }),
    ]);
    const [payment] = normalizeRpcTransaction(
      rpc(tx.toEnvelope().toXDR('base64'), 'FAILED'),
      target,
      passphrase,
    );
    expect(payment?.successful).toBe(false);
    expect(payment?.memo).toEqual({ type: 'none' });
  });

  it('returns nothing for transactions that do not pay the address', () => {
    const tx = build([
      Operation.payment({
        destination: other,
        asset: Asset.native(),
        amount: '1',
      }),
    ]);
    expect(
      normalizeRpcTransaction(
        rpc(tx.toEnvelope().toXDR('base64')),
        target,
        passphrase,
      ),
    ).toEqual([]);
  });

  it('flags the strict-send amount as a minimum, not the received amount', () => {
    const tx = new TransactionBuilder(new Account(source.publicKey(), '1'), {
      fee: '100',
      networkPassphrase: passphrase,
    })
      .addOperation(
        Operation.pathPaymentStrictSend({
          sendAsset: Asset.native(),
          sendAmount: '10',
          destination: target,
          destAsset: new Asset('USDC', issuer),
          destMin: '9.5',
        }),
      )
      .setTimeout(0)
      .build();
    tx.sign(source);

    const [payment] = normalizeRpcTransaction(
      rpc(tx.toEnvelope().toXDR('base64')),
      target,
      passphrase,
    );
    expect(payment).toMatchObject({
      kind: 'path_payment_strict_send',
      amount: '9.5000000',
      amountExact: false,
    });
  });

  it('reads the inner transaction of a fee bump', () => {
    const inner = build(
      [
        Operation.payment({
          destination: target,
          asset: Asset.native(),
          amount: '2',
        }),
      ],
      Memo.id('77'),
    );
    const feeBump = TransactionBuilder.buildFeeBumpTransaction(
      source,
      '200',
      inner,
      passphrase,
    );
    feeBump.sign(source);

    const [payment] = normalizeRpcTransaction(
      rpc(feeBump.toEnvelope().toXDR('base64')),
      target,
      passphrase,
    );
    expect(payment).toMatchObject({
      amount: '2.0000000',
      memo: { type: 'id', value: '77' },
    });
  });
});
