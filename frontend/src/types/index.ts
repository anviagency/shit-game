export type TerrainType = 'plains' | 'forest' | 'mountains' | 'water' | 'desert' | 'tundra' | 'jungle' | 'swamp';
export type BuildingType = 'farm' | 'mine' | 'lumberMill' | 'market' | 'barracks' | 'wall' | 'library' | 'tower' | 'embassy';
export type ActionType = 'gather' | 'build' | 'train' | 'clone' | 'move' | 'attack' | 'research' | 'fortify' | 'propose_peace' | 'propose_alliance' | 'break_treaty' | 'trade';

export interface Building {
  type: BuildingType;
  hp: number;
  level: number;
}

export interface MapCell {
  x: number;
  y: number;
  terrain: TerrainType;
  owner: string | null;
  building: Building | null;
  units: number;
  richness: number;
}

export interface Resources {
  gold: number;
  food: number;
  wood: number;
  iron: number;
  knowledge: number;
}

export interface Attributes {
  hp: number;
  strength: number;
  wisdom: number;
  agility: number;
  engineering: number;
  charisma: number;
}

export interface DiplomaticRelation {
  type: 'peace' | 'alliance' | 'war' | 'neutral';
  turnsRemaining: number;
  proposedBy: string;
}

export type SkillCategory = 'military' | 'economy' | 'diplomacy' | 'knowledge';

export interface SkillDef {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  maxLevel: number;
  requires?: string;
}

export interface AgentSkill {
  id: string;
  level: number;
  unlockedAtTurn: number;
}

// Mirror of backend SKILL_DEFINITIONS
export const SKILL_DEFINITIONS: SkillDef[] = [
  { id: 'ironFist', name: 'Iron Fist', category: 'military', description: '+10% attack power per level', maxLevel: 3 },
  { id: 'shieldWall', name: 'Shield Wall', category: 'military', description: '+10% defense per level', maxLevel: 3 },
  { id: 'blitz', name: 'Blitz', category: 'military', description: '+1 movement range per level', maxLevel: 2, requires: 'ironFist' },
  { id: 'warMachine', name: 'War Machine', category: 'military', description: 'Train 2x units per barracks', maxLevel: 1, requires: 'shieldWall' },
  { id: 'conqueror', name: 'Conqueror', category: 'military', description: '+25% territory capture speed', maxLevel: 1, requires: 'blitz' },
  { id: 'harvest', name: 'Harvest', category: 'economy', description: '+20% food per level', maxLevel: 3 },
  { id: 'goldRush', name: 'Gold Rush', category: 'economy', description: '+20% gold per level', maxLevel: 3 },
  { id: 'logistics', name: 'Logistics', category: 'economy', description: '-15% building cost per level', maxLevel: 2, requires: 'goldRush' },
  { id: 'industrialist', name: 'Industrialist', category: 'economy', description: '+50% building production', maxLevel: 1, requires: 'logistics' },
  { id: 'abundance', name: 'Abundance', category: 'economy', description: '-30% resource depletion', maxLevel: 1, requires: 'harvest' },
  { id: 'silverTongue', name: 'Silver Tongue', category: 'diplomacy', description: '+15% peace success per level', maxLevel: 3 },
  { id: 'ambassador', name: 'Ambassador', category: 'diplomacy', description: '+15% alliance success per level', maxLevel: 2, requires: 'silverTongue' },
  { id: 'spyNetwork', name: 'Spy Network', category: 'diplomacy', description: 'See enemy resources & units', maxLevel: 1, requires: 'ambassador' },
  { id: 'intimidation', name: 'Intimidation', category: 'diplomacy', description: 'Enemies less likely to attack you', maxLevel: 2 },
  { id: 'betrayalMaster', name: 'Betrayal Master', category: 'diplomacy', description: '-50% reputation loss on betrayal', maxLevel: 1, requires: 'intimidation' },
  { id: 'quickStudy', name: 'Quick Study', category: 'knowledge', description: '+25% XP gain per level', maxLevel: 3 },
  { id: 'innovation', name: 'Innovation', category: 'knowledge', description: '-20% research cost per level', maxLevel: 2, requires: 'quickStudy' },
  { id: 'architect', name: 'Architect', category: 'knowledge', description: '+50% building HP', maxLevel: 1, requires: 'innovation' },
  { id: 'adaptation', name: 'Adaptation', category: 'knowledge', description: '+1 to all attributes per level', maxLevel: 2 },
  { id: 'enlightenment', name: 'Enlightenment', category: 'knowledge', description: 'Double knowledge generation', maxLevel: 1, requires: 'adaptation' },
];

export interface Agent {
  id: string;
  name: string;
  color: string;
  personality: string;
  provider: string;
  attributes: Attributes;
  resources: Resources;
  totalUnits: number;
  cloneCount: number;
  maxClones: number;
  isAlive: boolean;
  reputation: number;
  memory: string[];
  // RPG fields
  xp: number;
  level: number;
  kills: number;
  battlesWon: number;
  battlesLost: number;
  treatiesMade: number;
  treatiesBroken: number;
  peakTerritory: number;
  // Skills
  skills: AgentSkill[];
  skillPoints: number;
}

export interface TurnDecision {
  turn: number;
  reasoning: string;
  actions: string[];
  personalityNote: string;
  timestamp: number;
}

export type ThinkingLogs = Record<string, TurnDecision[]>;

export interface Action {
  type: ActionType;
  agentId: string;
  targetX?: number;
  targetY?: number;
  sourceX?: number;
  sourceY?: number;
  buildingType?: BuildingType;
  attribute?: string;
  unitCount?: number;
  targetAgentId?: string;
  giveResource?: string;
  giveAmount?: number;
  wantResource?: string;
  wantAmount?: number;
}

export interface TurnLogEntry {
  turn: number;
  agentId: string;
  agentName: string;
  action: Action;
  result: string;
  success: boolean;
}

export interface GameState {
  map: MapCell[][];
  agents: Agent[];
  turn: number;
  maxTurns: number;
  turnLog: TurnLogEntry[];
  gameOver: boolean;
  winner: string | null;
  phase: 'waiting' | 'running' | 'paused' | 'finished';
  diplomacy: Record<string, DiplomaticRelation>;
}
