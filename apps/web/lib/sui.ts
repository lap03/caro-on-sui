import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { createNetworkConfig } from '@mysten/dapp-kit';
import { SUI_NETWORK } from './constants';

const { networkConfig } = createNetworkConfig({
  testnet: { url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' as const },
  mainnet: { url: getJsonRpcFullnodeUrl('mainnet'), network: 'mainnet' as const },
  devnet: { url: getJsonRpcFullnodeUrl('devnet'), network: 'devnet' as const },
});

export { networkConfig, SUI_NETWORK };
