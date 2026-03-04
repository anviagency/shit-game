export type TerrainType = 'plains' | 'forest' | 'mountains' | 'water' | 'desert' | 'tundra' | 'jungle' | 'swamp';
export type BuildingType = 'farm' | 'mine' | 'lumberMill' | 'market' | 'barracks' | 'wall' | 'library' | 'tower' | 'embassy';
export type ActionType = 'gather' | 'build' | 'train' | 'clone' | 'move' | 'attack' | 'research' | 'fortify' | 'propose_peace' | 'propose_alliance' | 'break_treaty';

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
