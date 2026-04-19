'use client';

import { useCallback, useRef, useState } from 'react';
import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import type { SessionKey } from '@mysten/seal';
import { createSessionKey, encryptMove, decryptMove } from '@/lib/seal';

/**
 * Challenge Mode Seal lifecycle.
 *
 * Holds one SessionKey per connected account; the first Challenge-Mode move
 * prompts the wallet to sign a session-key challenge, after which the TTL (10
 * min) lets every subsequent move encrypt+decrypt without re-prompting.
 */
export function useSeal() {
  const account = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const sessionKeyRef = useRef<SessionKey | null>(null);
  const [isPreparingSession, setIsPreparingSession] = useState(false);

  const ensureSessionKey = useCallback(async (): Promise<SessionKey> => {
    if (!account) throw new Error('Wallet not connected');
    const existing = sessionKeyRef.current;
    if (existing && !existing.isExpired()) return existing;

    setIsPreparingSession(true);
    try {
      const key = await createSessionKey(account.address, async (message) => {
        const res = await signPersonalMessage({ message });
        return { signature: res.signature };
      });
      sessionKeyRef.current = key;
      return key;
    } finally {
      setIsPreparingSession(false);
    }
  }, [account, signPersonalMessage]);

  const encryptPlayerMove = useCallback(
    async (packageId: string, gameId: string, row: number, col: number) => {
      return encryptMove(packageId, gameId, { row, col });
    },
    [],
  );

  const decryptPlayerMove = useCallback(
    async (encrypted: Uint8Array, gameId: string) => {
      const sessionKey = await ensureSessionKey();
      return decryptMove(encrypted, sessionKey, gameId);
    },
    [ensureSessionKey],
  );

  return {
    ensureSessionKey,
    encryptPlayerMove,
    decryptPlayerMove,
    isPreparingSession,
  };
}
