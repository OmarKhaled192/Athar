import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 45000, fullyParallel: false, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:8000', ...devices['Desktop Chrome'], viewport: { width: 1366, height: 800 } },
  webServer: { command: 'python -m http.server 8000 --bind 127.0.0.1', url: 'http://127.0.0.1:8000', reuseExistingServer: true, timeout: 15000 }
});
