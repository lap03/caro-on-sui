// Vercel serverless function — mirror of apps/api/src/index.ts#POST /api/execute.
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

  try {
    const body = req.body as { digest: string; signature: string };
    const enokiClient = new EnokiClient({ apiKey: enokiSecretKey });
    const result = await enokiClient.executeSponsoredTransaction({
      digest: body.digest,
      signature: body.signature,
    });
    res.status(200).json(result);
  } catch (error: any) {
    console.error('Execute error:', error?.message || error);
    res.status(500).json({ error: error?.message || String(error) });
  }
}
