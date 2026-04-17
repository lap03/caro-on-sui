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

  // Create a sponsored transaction
  app.post('/api/sponsor', async (c) => {
    try {
      const { txKindBytes, sender } = await c.req.json();

      const sponsored = await enokiClient.createSponsoredTransaction({
        network: 'testnet',
        transactionKindBytes: txKindBytes,
        sender,
        allowedMoveCallTargets: [
          `${process.env.PACKAGE_ID}::game::new_game`,
          `${process.env.PACKAGE_ID}::game::play`,
          `${process.env.PACKAGE_ID}::game::resign`,
          `${process.env.PACKAGE_ID}::leaderboard::record_result`,
        ],
      });

      return c.json(sponsored);
    } catch (error: any) {
      console.error('Sponsor error:', error);
      return c.json({ error: error.message }, 500);
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
