import type { Server } from 'node:http';
import process from 'node:process';
import { bootstrapApp } from './app.ts';
import { disconnectDatabase } from './config/database.ts';
import { appConfig } from './config/env.ts';

const app = await bootstrapApp();

const server: Server = app.listen(appConfig.port, (): void => {
  console.log(
    `[startup] campushub-backend listening on http://localhost:${appConfig.port}${appConfig.apiPrefix} (${appConfig.nodeEnv})`,
  );
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`[shutdown] received ${signal}, closing server`);
  server.close((error?: Error): void => {
    disconnectDatabase()
      .catch((disconnectError: unknown): void => {
        console.error(
          '[shutdown] failed to close the database',
          disconnectError,
        );
      })
      .finally((): void => {
        process.exit(error === undefined ? 0 : 1);
      });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason: unknown): void => {
  console.error('[fatal] unhandled promise rejection', reason);
  process.exit(1);
});
