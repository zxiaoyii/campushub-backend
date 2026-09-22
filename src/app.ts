import express, { type Express } from 'express';
import { appConfig } from './config/env.ts';
import { errorHandler, notFoundHandler } from './middleware/error-handler.ts';
import { apiV1Router } from './routes/index.ts';

/**
 * Builds the configured Express application without binding a port, so the app
 * stays importable by tests and by the process bootstrap in server.ts.
 */
export function createApp(): Express {
  const app: Express = express();

  app.use(express.json());
  app.use(appConfig.apiPrefix, apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
