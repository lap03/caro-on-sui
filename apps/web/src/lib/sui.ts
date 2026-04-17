import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { createNetworkConfig } from '@mysten/dapp-kit';
import { SUI_NETWORK } from './constants';

const { networkConfig } = createNetworkConfig({
  testnet: { url: getJsonRpcFullnodeUrl('testnet') },
  mainnet: { url: getJsonRpcFullnodeUrl('mainnet') },
  devnet: { url: getJsonRpcFullnodeUrl('devnet') },
});

export { networkConfig, SUI_NETWORK };
