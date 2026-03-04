import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from project root (two levels up from config/)
dotenv.config({ path: resolve(__dirname, '../../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  gameSpeedMs: parseInt(process.env.GAME_SPEED_MS || '2000', 10),
  mapSize: parseInt(process.env.MAP_SIZE || '20', 10),
  maxTurns: parseInt(process.env.MAX_TURNS || '200', 10),
};
