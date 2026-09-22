import type { Server } from 'node:http';
import process from 'node:process';
import { createApp } from './app.ts';
import { appConfig } from './config/env.ts';

const app = createApp();

const server: Server = app.listen(appConfig.port, (): void => {
  console.log(
    `[startup] campushub-backend listening on http://localhost:${appConfig.port}${appConfig.apiPrefix} (${appConfig.nodeEnv})`,
  );
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[shutdown] received ${signal}, closing server`);
  server.close((error?: Error): void => {
    if (error !== undefined) {
      console.error('[shutdown] failed to close server cleanly', error.message);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason: unknown): void => {
  console.error('[fatal] unhandled promise rejection', reason);
  process.exit(1);
});
