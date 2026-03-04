import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from './config/index.js';
import { GameEngine } from './engine/GameEngine.js';
import { AgentManager } from './agents/AgentManager.js';
import { OpenAIProvider } from './agents/OpenAIProvider.js';
import { AnthropicProvider } from './agents/AnthropicProvider.js';
import { logger } from './utils/logger.js';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Determine if we should use real LLMs
const hasOpenAI = config.openaiApiKey && config.openaiApiKey.startsWith('sk-');
const hasAnthropic = config.anthropicApiKey && config.anthropicApiKey.startsWith('sk-');
const useMockLLM = !hasOpenAI && !hasAnthropic;

if (useMockLLM) {
  logger.info('No LLM API keys found. Running with mock AI agents.');
} else {
  logger.info(`LLM providers: OpenAI=${hasOpenAI ? 'yes' : 'no'}, Anthropic=${hasAnthropic ? 'yes' : 'no'}`);
}

const agentManager = new AgentManager(useMockLLM);

if (hasOpenAI) {
  agentManager.registerProvider('openai', new OpenAIProvider(config.openaiApiKey));
}
if (hasAnthropic) {
  agentManager.registerProvider('anthropic', new AnthropicProvider(config.anthropicApiKey));
}

let engine: GameEngine | null = null;

function createEngine(): GameEngine {
  const eng = new GameEngine(agentManager, (state) => {
    io.emit('gameState', state);
    io.emit('thinkingLogs', eng.getThinkingLogs());
  }, config.gameSpeedMs);
  return eng;
}

// REST endpoints
app.get('/api/status', (_req, res) => {
  res.json({
    running: engine !== null,
    state: engine?.getState() || null,
  });
});

app.post('/api/game/start', (_req, res) => {
  engine = createEngine();
  engine.start();
  logger.info('Game started');
  res.json({ message: 'Game started', state: engine.getState() });
});

app.post('/api/game/pause', (_req, res) => {
  if (engine) {
    engine.pause();
    res.json({ message: 'Game paused' });
  } else {
    res.status(400).json({ error: 'No game running' });
  }
});

app.post('/api/game/resume', (_req, res) => {
  if (engine) {
    engine.resume();
    res.json({ message: 'Game resumed' });
  } else {
    res.status(400).json({ error: 'No game running' });
  }
});

app.post('/api/game/speed', (req, res) => {
  const { speed } = req.body;
  if (engine && typeof speed === 'number') {
    engine.setSpeed(speed);
    res.json({ message: `Speed set to ${speed}ms` });
  } else {
    res.status(400).json({ error: 'Invalid speed or no game running' });
  }
});

app.post('/api/game/restart', (_req, res) => {
  if (engine) engine.pause();
  engine = createEngine();
  engine.start();
  logger.info('Game restarted');
  res.json({ message: 'Game restarted', state: engine.getState() });
});

// Socket.io
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  if (engine) {
    socket.emit('gameState', engine.getState());
    socket.emit('thinkingLogs', engine.getThinkingLogs());
  }

  socket.on('startGame', () => {
    engine = createEngine();
    engine.start();
    io.emit('gameState', engine.getState());
  });

  socket.on('pauseGame', () => {
    engine?.pause();
  });

  socket.on('resumeGame', () => {
    engine?.resume();
  });

  socket.on('setSpeed', (speed: number) => {
    engine?.setSpeed(speed);
  });

  socket.on('restartGame', () => {
    if (engine) engine.pause();
    engine = createEngine();
    engine.start();
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

httpServer.listen(config.port, () => {
  logger.info(`Server running on http://localhost:${config.port}`);
});
