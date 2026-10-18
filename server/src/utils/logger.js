import pino from 'pino';
import { config } from '../config/env.js';

// Credentials that arrive in headers never reach the logs.
export const LOG_REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-origin-secret"]',
  'res.headers["set-cookie"]',
];

const usePretty = !config.isProduction && !config.isTest;

export const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  redact: LOG_REDACT,
  ...(usePretty && { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});
