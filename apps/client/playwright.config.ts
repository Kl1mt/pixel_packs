import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const API_PORT = 3101;
const ORIGIN = `http://127.0.0.1:${String(PORT)}`;

/**
 * Browser checks for the client: the style guide screenshots (T07) and the auth
 * flow (T09) against a real server on an in-memory PGlite database.
 * Run: pnpm --filter @pixel-packs/client e2e
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: ORIGIN,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // No `.env` here on purpose: a fresh database, no Discord, no rate limits.
      command: 'pnpm --filter @pixel-packs/server exec tsx src/main.ts',
      url: `http://127.0.0.1:${String(API_PORT)}/api/health`,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        HOST: '127.0.0.1',
        PGLITE_DIR: 'memory://',
        APP_ORIGIN: ORIGIN,
        LOG_LEVEL: 'warn',
        RATE_LIMIT: 'false',
        DISCORD_CLIENT_ID: '',
        DISCORD_CLIENT_SECRET: '',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: `pnpm exec vite --port ${String(PORT)} --strictPort --host 127.0.0.1`,
      url: ORIGIN,
      env: { VITE_API_TARGET: `http://127.0.0.1:${String(API_PORT)}` },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
