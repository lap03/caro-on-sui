import { EnokiClient } from '@mysten/enoki';

// Keep this on the Node runtime so @mysten/enoki's fetch/crypto path works like
// it did under Vercel's node handler.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const enokiSecretKey = process.env.ENOKI_SECRET_KEY;
  if (!enokiSecretKey) {
    return Response.json(
      { error: 'Sponsored transactions not configured. Set ENOKI_SECRET_KEY.' },
      { status: 503 },
    );
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
    const body = (await req.json()) as { txKindBytes: string; sender: string };
    sender = body.sender;

    const enokiClient = new EnokiClient({ apiKey: enokiSecretKey });
    const sponsored = await enokiClient.createSponsoredTransaction({
      network: 'testnet',
      transactionKindBytes: body.txKindBytes,
      sender,
      allowedMoveCallTargets,
    });

    return Response.json(sponsored);
  } catch (error: any) {
    const enokiErrors = error?.errors as
      | { code: string; message: string; data?: unknown }[]
      | undefined;
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
    return Response.json(
      { error: detail, code: enokiCode, errors: enokiErrors },
      { status: 500 },
    );
  }
}
