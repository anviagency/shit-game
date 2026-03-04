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

// ── Skills ──
export const SkillCategory = z.enum(['military', 'economy', 'diplomacy', 'knowledge']);
export type SkillCategory = z.infer<typeof SkillCategory>;

export interface SkillDef {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  maxLevel: number;
  requires?: string; // prerequisite skill id
}

export const AgentSkillSchema = z.object({
  id: z.string(),
  level: z.number().default(0),     // 0 = not unlocked
  unlockedAtTurn: z.number().default(0),
});
export type AgentSkill = z.infer<typeof AgentSkillSchema>;

// All available skills in the game
export const SKILL_DEFINITIONS: SkillDef[] = [
  // Military tree
  { id: 'ironFist', name: 'Iron Fist', category: 'military', description: '+10% attack power per level', maxLevel: 3 },
  { id: 'shieldWall', name: 'Shield Wall', category: 'military', description: '+10% defense per level', maxLevel: 3 },
  { id: 'blitz', name: 'Blitz', category: 'military', description: '+1 movement range per level', maxLevel: 2, requires: 'ironFist' },
  { id: 'warMachine', name: 'War Machine', category: 'military', description: 'Train 2x units per barracks', maxLevel: 1, requires: 'shieldWall' },
  { id: 'conqueror', name: 'Conqueror', category: 'military', description: '+25% territory capture speed', maxLevel: 1, requires: 'blitz' },
  // Economy tree
  { id: 'harvest', name: 'Harvest', category: 'economy', description: '+20% food per level', maxLevel: 3 },
  { id: 'goldRush', name: 'Gold Rush', category: 'economy', description: '+20% gold per level', maxLevel: 3 },
  { id: 'logistics', name: 'Logistics', category: 'economy', description: '-15% building cost per level', maxLevel: 2, requires: 'goldRush' },
  { id: 'industrialist', name: 'Industrialist', category: 'economy', description: '+50% building production', maxLevel: 1, requires: 'logistics' },
  { id: 'abundance', name: 'Abundance', category: 'economy', description: '-30% resource depletion', maxLevel: 1, requires: 'harvest' },
  // Diplomacy tree
  { id: 'silverTongue', name: 'Silver Tongue', category: 'diplomacy', description: '+15% peace success per level', maxLevel: 3 },
  { id: 'ambassador', name: 'Ambassador', category: 'diplomacy', description: '+15% alliance success per level', maxLevel: 2, requires: 'silverTongue' },
  { id: 'spyNetwork', name: 'Spy Network', category: 'diplomacy', description: 'See enemy resources & units', maxLevel: 1, requires: 'ambassador' },
  { id: 'intimidation', name: 'Intimidation', category: 'diplomacy', description: 'Enemies less likely to attack you', maxLevel: 2 },
  { id: 'betrayalMaster', name: 'Betrayal Master', category: 'diplomacy', description: '-50% reputation loss on betrayal', maxLevel: 1, requires: 'intimidation' },
  // Knowledge tree
  { id: 'quickStudy', name: 'Quick Study', category: 'knowledge', description: '+25% XP gain per level', maxLevel: 3 },
  { id: 'innovation', name: 'Innovation', category: 'knowledge', description: '-20% research cost per level', maxLevel: 2, requires: 'quickStudy' },
  { id: 'architect', name: 'Architect', category: 'knowledge', description: '+50% building HP', maxLevel: 1, requires: 'innovation' },
  { id: 'adaptation', name: 'Adaptation', category: 'knowledge', description: '+1 to all attributes per level', maxLevel: 2 },
  { id: 'enlightenment', name: 'Enlightenment', category: 'knowledge', description: 'Double knowledge generation', maxLevel: 1, requires: 'adaptation' },
];

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
  skills: z.array(AgentSkillSchema).default([]),
  skillPoints: z.number().default(0),  // earned from leveling up
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
