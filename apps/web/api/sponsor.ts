// Vercel serverless function — mirror of apps/api/src/index.ts#POST /api/sponsor.
// Deployed at <your-app>.vercel.app/api/sponsor (same origin as the frontend).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { EnokiClient } from '@mysten/enoki';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const enokiSecretKey = process.env.ENOKI_SECRET_KEY;
  if (!enokiSecretKey) {
    res.status(503).json({ error: 'Sponsored transactions not configured. Set ENOKI_SECRET_KEY.' });
    return;
  }

  // Accept one or more comma-separated package ids (e.g. "0xNEW,0xLEGACY") so
  // Enoki's original-id-normalized allowlist check passes across upgrades.
  const packageIds = (process.env.PACKAGE_ID || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const allowedMoveCallTargets = packageIds.flatMap((pkg) => [
    `${pkg}::game::new_game`,
    `${pkg}::game::play`,
    `${pkg}::game::resign`,
    `${pkg}::game::attach_replay`,
    `${pkg}::leaderboard::record_result`,
  ]);

  let sender = '?';
  try {
    const body = req.body as { txKindBytes: string; sender: string };
    sender = body.sender;

    const enokiClient = new EnokiClient({ apiKey: enokiSecretKey });
    const sponsored = await enokiClient.createSponsoredTransaction({
      network: 'testnet',
      transactionKindBytes: body.txKindBytes,
      sender,
      allowedMoveCallTargets,
    });

    res.status(200).json(sponsored);
  } catch (error: any) {
    const enokiErrors = error?.errors as { code: string; message: string; data?: unknown }[] | undefined;
    const enokiCode = error?.code as string | undefined;
    const enokiStatus = error?.status as number | undefined;
    console.error('Sponsor error:', {
      message: error?.message,
      status: enokiStatus,
      code: enokiCode,
      errors: enokiErrors,
      sender,
      allowlist: allowedMoveCallTargets,
    });
    const detail = enokiErrors?.[0]?.message ?? error?.message ?? String(error);
    res.status(500).json({ error: detail, code: enokiCode, errors: enokiErrors });
  }
}
