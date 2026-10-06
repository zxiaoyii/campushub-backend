import process from 'node:process';
import { config as loadDotenv } from 'dotenv';

loadDotenv();

export type NodeEnv = 'development' | 'test' | 'production';

export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly apiPrefix: string;
  readonly mongoUri: string;
  readonly mongoTimeoutMs: number;
}

const DEFAULT_PORT = 3000;
const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/campushub';
const DEFAULT_MONGO_TIMEOUT_MS = 5000;
const API_PREFIX = '/api/v1';
const NODE_ENVS: readonly NodeEnv[] = ['development', 'test', 'production'];

function parseNodeEnv(raw: string | undefined): NodeEnv {
  if (raw === undefined || raw.trim() === '') {
    return 'development';
  }
  const candidate = raw.trim();
  const match = NODE_ENVS.find(
    (value: NodeEnv): boolean => value === candidate,
  );
  if (match === undefined) {
    throw new Error(
      `Invalid NODE_ENV "${raw}". Expected one of: ${NODE_ENVS.join(', ')}.`,
    );
  }
  return match;
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PORT;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(
      `Invalid PORT "${raw}". Expected an integer between 1 and 65535.`,
    );
  }
  return parsed;
}

function parseMongoUri(raw: string | undefined): string {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_MONGO_URI;
  }
  const uri = raw.trim();
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    throw new Error(
      'Invalid MONGODB_URI. Expected it to start with mongodb:// or mongodb+srv://.',
    );
  }
  return uri;
}

function loadConfig(): AppConfig {
  return {
    nodeEnv: parseNodeEnv(process.env['NODE_ENV']),
    port: parsePort(process.env['PORT']),
    apiPrefix: API_PREFIX,
    mongoUri: parseMongoUri(process.env['MONGODB_URI']),
    mongoTimeoutMs: DEFAULT_MONGO_TIMEOUT_MS,
  };
}

export const appConfig: AppConfig = loadConfig();
