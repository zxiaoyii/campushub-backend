/**
 * Boots the stack the end-to-end suite runs against and keeps it alive until
 * Playwright stops it.
 *
 * The API is the real entry point (`src/server.ts`) and the real seed script,
 * pointed at an ephemeral MongoDB on a throwaway port, so a run can neither
 * read nor overwrite the development database. Playwright launches this file
 * as a `webServer` and ends it with SIGTERM; both children and the database
 * have to come down with it, or the next run inherits a stale port.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import process from 'node:process';
import { MongoMemoryServer } from 'mongodb-memory-server';

const API_PORT = process.env['E2E_API_PORT'] ?? '3100';

const mongo = await MongoMemoryServer.create();

const childEnv: NodeJS.ProcessEnv = {
  ...process.env,
  MONGODB_URI: mongo.getUri('campushub-e2e'),
  PORT: API_PORT,
};

/** Runs a script to completion, rejecting if it fails, so a bad seed stops the run. */
function runToCompletion(script: string): Promise<void> {
  return new Promise<void>((resolve, reject): void => {
    const child = spawn('node', [script], {
      env: childEnv,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code: number | null): void => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${script} exited with code ${String(code)}`));
    });
  });
}

await runToCompletion('src/seed.ts');

const api: ChildProcess = spawn('node', ['src/server.ts'], {
  env: childEnv,
  stdio: 'inherit',
});

let stopping = false;

async function shutdown(code: number): Promise<void> {
  if (stopping) {
    return;
  }
  stopping = true;
  if (api.exitCode === null) {
    api.kill('SIGTERM');
  }
  await mongo.stop();
  process.exit(code);
}

api.on('exit', (code: number | null): void => {
  void shutdown(code ?? 1);
});

process.on('SIGTERM', (): void => {
  void shutdown(0);
});

process.on('SIGINT', (): void => {
  void shutdown(0);
});
