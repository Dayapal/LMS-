import pino from 'pino';
import { config } from '../config/env.js';

const usePretty = !config.isProduction && !config.isTest;

export const logger = pino({
  level: config.isTest ? 'silent' : config.logLevel,
  redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
  ...(usePretty && { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});
