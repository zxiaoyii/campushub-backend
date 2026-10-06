import express, { type Express } from 'express';
import { connectDatabase } from './config/database.ts';
import { appConfig } from './config/env.ts';
import { errorHandler, notFoundHandler } from './middleware/error-handler.ts';
import { apiV1Router } from './routes/index.ts';

/**
 * Builds the configured Express application without binding a port or opening
 * a connection, so it stays importable by tests.
 */
export function createApp(): Express {
  const app: Express = express();

  app.use(express.json());
  app.use(appConfig.apiPrefix, apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/** Opens the database connection from config, then returns the wired app. */
export async function bootstrapApp(): Promise<Express> {
  await connectDatabase();
  return createApp();
}
