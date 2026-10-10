import { defineConfig } from '@playwright/test';
import { getArceDeployment } from './deployment.js';
const deployment = getArceDeployment(process.env.ARCE_TARGET);
export default defineConfig({
  testDir: './tests', timeout: 90000, workers: 1,
  outputDir: `../../evidence/arce-${deployment.target}-test-results`,
  reporter: [['list'], ['html', { outputFolder: `../../evidence/arce-${deployment.target}-report`, open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4183', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: deployment.target === 'github-pages'
      ? 'bunx --no-install vite preview --host 127.0.0.1 --port 4183 --strictPort'
      : `python3 -m http.server 4183 --bind 127.0.0.1 --directory ${deployment.outputDir}/upload`,
    cwd: process.cwd(), url: `http://127.0.0.1:4183${deployment.sitePath}`, timeout: 10000,
  },
});
