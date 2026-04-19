import { EnokiClient } from '@mysten/enoki';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const enokiSecretKey = process.env.ENOKI_SECRET_KEY;
  if (!enokiSecretKey) {
    return Response.json(
      { error: 'Sponsored transactions not configured. Set ENOKI_SECRET_KEY.' },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json()) as { digest: string; signature: string };
    const enokiClient = new EnokiClient({ apiKey: enokiSecretKey });
    const result = await enokiClient.executeSponsoredTransaction({
      digest: body.digest,
      signature: body.signature,
    });
    return Response.json(result);
  } catch (error: any) {
    console.error('Execute error:', error?.message || error);
    return Response.json({ error: error?.message || String(error) }, { status: 500 });
  }
}
