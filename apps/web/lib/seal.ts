import { SealClient, SessionKey, type SealCompatibleClient } from '@mysten/seal';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';
import {
  SEAL_PACKAGE_ID,
  SEAL_SERVER_OBJECT_ID,
  SUI_NETWORK,
} from './constants';

const suiClient = new SuiJsonRpcClient({
  url: getJsonRpcFullnodeUrl(SUI_NETWORK as 'testnet' | 'mainnet' | 'devnet'),
  network: SUI_NETWORK as 'testnet' | 'mainnet' | 'devnet',
});

/**
 * Singleton Seal client. Uses the testnet key server as a single-threshold provider.
 * `verifyKeyServers: false` is safe on testnet only — production should verify.
 */
export const sealClient = new SealClient({
  suiClient: suiClient as unknown as SealCompatibleClient,
  serverConfigs: [
    {
      objectId: SEAL_SERVER_OBJECT_ID,
      weight: 1,
    },
  ],
  verifyKeyServers: false,
});

/**
 * Encrypt a player move against the game's identity. Returns the Seal
 * `encryptedObject` bytes — opaque ciphertext the rest of the app treats as a blob.
 */
export async function encryptMove(
  packageId: string,
  gameId: string,
  move: { row: number; col: number },
): Promise<Uint8Array> {
  const { encryptedObject } = await sealClient.encrypt({
    threshold: 1,
    packageId,
    id: gameId,
    data: new TextEncoder().encode(JSON.stringify(move)),
  });
  return encryptedObject;
}

/**
 * Decrypt a previously encrypted move. The caller must own a valid SessionKey
 * whose personal-message signature has been set.
 *
 * We build the seal_approve dry-run transaction here so callers only need the
 * game id + ciphertext. `txBytes` is the `onlyTransactionKind` serialization —
 * key servers evaluate this via dry_run_transaction_block.
 */
export async function decryptMove(
  encryptedObject: Uint8Array,
  sessionKey: SessionKey,
  gameId: string,
): Promise<{ row: number; col: number }> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${SEAL_PACKAGE_ID}::seal_policy::seal_approve`,
    arguments: [tx.pure.vector('u8', hexToBytes(gameId)), tx.object(gameId)],
  });
  const txBytes = await tx.build({
    client: suiClient,
    onlyTransactionKind: true,
  });

  const plaintext = await sealClient.decrypt({
    data: encryptedObject,
    sessionKey,
    txBytes,
  });

  return JSON.parse(new TextDecoder().decode(plaintext));
}

/**
 * Create + prime a SessionKey. The caller provides a `signPersonalMessage`
 * callback (from dapp-kit's useSignPersonalMessage) so we stay decoupled from
 * any particular wallet integration.
 */
export async function createSessionKey(
  address: string,
  signPersonalMessage: (msg: Uint8Array) => Promise<{ signature: string }>,
): Promise<SessionKey> {
  const sessionKey = await SessionKey.create({
    address,
    packageId: SEAL_PACKAGE_ID,
    ttlMin: 10,
    suiClient: suiClient as unknown as SealCompatibleClient,
  });
  const message = sessionKey.getPersonalMessage();
  const { signature } = await signPersonalMessage(message);
  await sessionKey.setPersonalMessageSignature(signature);
  return sessionKey;
}

function hexToBytes(hex: string): number[] {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return bytes;
}
