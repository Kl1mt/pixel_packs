import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;

/** Browser checks for the client (T07: style guide screenshot). Run: pnpm --filter @pixel-packs/client e2e */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${String(PORT)}`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec vite --port ${String(PORT)} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${String(PORT)}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
