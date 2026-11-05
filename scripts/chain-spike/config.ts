import { Networks } from '@stellar/stellar-base';

/**
 * Endpoints default to the public Stellar TESTNET URLs from the official docs
 * (https://developers.stellar.org/docs/networks) and can be overridden with
 * environment variables, for example to use a third-party provider.
 */
export interface SpikeConfig {
  horizonUrl: string;
  rpcUrl: string;
  friendbotUrl: string;
  networkPassphrase: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SpikeConfig {
  const config: SpikeConfig = {
    horizonUrl: env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org',
    rpcUrl: env.STELLAR_RPC_URL ?? 'https://soroban-testnet.stellar.org',
    friendbotUrl: env.FRIENDBOT_URL ?? 'https://friendbot.stellar.org',
    // Fixed on purpose: this spike must never run against mainnet.
    networkPassphrase: Networks.TESTNET,
  };

  for (const [name, url] of Object.entries(config)) {
    if (name !== 'networkPassphrase' && /mainnet|pubnet/i.test(url)) {
      throw new Error(
        `${name} (${url}) looks like a mainnet endpoint. This spike is testnet-only.`,
      );
    }
  }
  return config;
}
