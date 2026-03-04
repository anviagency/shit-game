import { z } from 'zod';

// ── Terrain ──
export const TerrainType = z.enum([
  'plains', 'forest', 'mountains', 'water', 'desert', 'tundra', 'jungle', 'swamp',
]);
export type TerrainType = z.infer<typeof TerrainType>;

// ── Buildings ──
export const BuildingType = z.enum([
  'farm', 'mine', 'lumberMill', 'market', 'barracks', 'wall', 'library', 'tower', 'embassy',
]);
export type BuildingType = z.infer<typeof BuildingType>;

export const BuildingSchema = z.object({
  type: BuildingType,
  hp: z.number(),
  level: z.number().default(1),
});
export type Building = z.infer<typeof BuildingSchema>;

// ── Map Cell ──
export const MapCellSchema = z.object({
  x: z.number(),
  y: z.number(),
  terrain: TerrainType,
  owner: z.string().nullable(),
  building: BuildingSchema.nullable(),
  units: z.number().default(0),
  richness: z.number().default(100),   // resource depletion 0-100
});
export type MapCell = z.infer<typeof MapCellSchema>;

// ── Resources ──
export const ResourcesSchema = z.object({
  gold: z.number(),
  food: z.number(),
  wood: z.number(),
  iron: z.number(),
  knowledge: z.number(),
});
export type Resources = z.infer<typeof ResourcesSchema>;

// ── Agent Attributes ──
export const AttributesSchema = z.object({
  hp: z.number(),
  strength: z.number(),
  wisdom: z.number(),
  agility: z.number(),
  engineering: z.number(),
  charisma: z.number(),
});
export type Attributes = z.infer<typeof AttributesSchema>;

// ── Diplomacy ──
export interface DiplomaticRelation {
  type: 'peace' | 'alliance' | 'war' | 'neutral';
  turnsRemaining: number;       // for peace/alliance
  proposedBy: string;           // who initiated
}

// ── Turn Decision (RPG thinking log) ──
export interface TurnDecision {
  turn: number;
  reasoning: string;       // LLM's full reasoning text
  actions: string[];       // action summaries
  personalityNote: string; // personality at that moment
  timestamp: number;
}

// ── Agent ──
export const AgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  personality: z.string(),       // empty string = LLM decides
  provider: z.enum(['openai', 'anthropic']),
  attributes: AttributesSchema,
  resources: ResourcesSchema,
  totalUnits: z.number(),
  cloneCount: z.number().default(0),
  maxClones: z.number().default(5),
  isAlive: z.boolean().default(true),
  reputation: z.number().default(50),   // 0=treacherous, 100=trustworthy
  memory: z.array(z.string()).default([]),  // agent's self-built memory of events
  // RPG fields
  xp: z.number().default(0),
  level: z.number().default(1),
  kills: z.number().default(0),
  battlesWon: z.number().default(0),
  battlesLost: z.number().default(0),
  treatiesMade: z.number().default(0),
  treatiesBroken: z.number().default(0),
  peakTerritory: z.number().default(0),
});
export type Agent = z.infer<typeof AgentSchema>;

// Separate from schema because it holds non-serializable-heavy data
export interface AgentThinkingLog {
  [agentId: string]: TurnDecision[];
}

// ── Actions ──
export const ActionType = z.enum([
  'gather', 'build', 'train', 'clone', 'move', 'attack', 'research', 'fortify',
  'propose_peace', 'propose_alliance', 'break_treaty',
]);
export type ActionType = z.infer<typeof ActionType>;

export const ActionSchema = z.object({
  type: ActionType,
  agentId: z.string(),
  targetX: z.number().optional(),
  targetY: z.number().optional(),
  sourceX: z.number().optional(),
  sourceY: z.number().optional(),
  buildingType: BuildingType.optional(),
  attribute: z.enum(['hp', 'strength', 'wisdom', 'agility', 'engineering', 'charisma']).optional(),
  unitCount: z.number().optional(),
  targetAgentId: z.string().optional(),   // for diplomacy actions
});
export type Action = z.infer<typeof ActionSchema>;

// ── LLM Response ──
export const LLMResponseSchema = z.object({
  actions: z.array(ActionSchema).min(1).max(3),
  reasoning: z.string().optional(),
  personality_note: z.string().optional(),  // agent describes its evolving personality
});
export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// ── Turn Log Entry ──
export interface TurnLogEntry {
  turn: number;
  agentId: string;
  agentName: string;
  action: Action;
  result: string;
  success: boolean;
}

// ── Full Game State ──
export interface GameState {
  map: MapCell[][];
  agents: Agent[];
  turn: number;
  maxTurns: number;
  turnLog: TurnLogEntry[];
  gameOver: boolean;
  winner: string | null;
  phase: 'waiting' | 'running' | 'paused' | 'finished';
  diplomacy: Record<string, DiplomaticRelation>;  // key: "agentA-agentB" sorted
}
