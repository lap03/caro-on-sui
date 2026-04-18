import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { EnokiClient } from '@mysten/enoki';

const app = new Hono();

// CORS configuration
app.use('/*', cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
}));

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Enoki sponsored transaction endpoints
// These require ENOKI_SECRET_KEY to be set in .env
const enokiSecretKey = process.env.ENOKI_SECRET_KEY;

if (enokiSecretKey) {
  const enokiClient = new EnokiClient({
    apiKey: enokiSecretKey,
  });

  // Build the sponsorship allowlist from env. Accept multiple comma-separated
  // package ids under PACKAGE_ID so a package upgrade doesn't break in-flight
  // sessions that were loaded before the env bump.
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

  console.log('🔑 Enoki allowlist:');
  for (const t of allowedMoveCallTargets) console.log('   •', t);
  if (allowedMoveCallTargets.length === 0) {
    console.warn('   (empty — PACKAGE_ID env var is missing)');
  }

  // Create a sponsored transaction
  app.post('/api/sponsor', async (c) => {
    let sender = '?';
    try {
      const body = await c.req.json();
      sender = body.sender;

      const sponsored = await enokiClient.createSponsoredTransaction({
        network: 'testnet',
        transactionKindBytes: body.txKindBytes,
        sender,
        allowedMoveCallTargets,
      });

      return c.json(sponsored);
    } catch (error: any) {
      // EnokiClientError exposes .errors[] + .code with the real reason.
      // Without these we only see "Request to Enoki API failed (status: 400)".
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
      // Forward the most informative message possible.
      const detail =
        enokiErrors?.[0]?.message ??
        error?.message ??
        String(error);
      return c.json(
        {
          error: detail,
          code: enokiCode,
          errors: enokiErrors,
        },
        500,
      );
    }
  });

  // Execute a sponsored transaction
  app.post('/api/execute', async (c) => {
    try {
      const { digest, signature } = await c.req.json();

      const result = await enokiClient.executeSponsoredTransaction({
        digest,
        signature,
      });

      return c.json(result);
    } catch (error: any) {
      console.error('Execute error:', error);
      return c.json({ error: error.message }, 500);
    }
  });
} else {
  console.warn('⚠️  ENOKI_SECRET_KEY not set. Sponsored transactions disabled.');
  console.warn('   Set it in apps/api/.env to enable gasless gameplay.');

  app.post('/api/sponsor', (c) => {
    return c.json({ error: 'Sponsored transactions not configured. Set ENOKI_SECRET_KEY.' }, 503);
  });

  app.post('/api/execute', (c) => {
    return c.json({ error: 'Sponsored transactions not configured. Set ENOKI_SECRET_KEY.' }, 503);
  });
}

const port = Number(process.env.PORT) || 3001;

console.log(`🚀 Caro API server running at http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
