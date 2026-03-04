// ── Map ──
export const MAP_WIDTH = 50;
export const MAP_HEIGHT = 30;

// ── Starting Attributes (base) ──
export const BASE_ATTRIBUTES = {
  hp: 100,
  strength: 8,
  wisdom: 8,
  agility: 8,
  engineering: 8,
  charisma: 8,
};

// Each agent gets 15 bonus points distributed randomly across attributes
export const BONUS_ATTRIBUTE_POINTS = 15;

// ── Starting Resources ──
export const BASE_RESOURCES = {
  gold: 150,
  food: 120,
  wood: 80,
  iron: 40,
  knowledge: 0,
};

export const BASE_UNITS = 10;

// ── Clone Costs ──
export const CLONE_BASE_GOLD = 100;
export const CLONE_BASE_FOOD = 50;
export const MAX_CLONES = 5;
export const CLONE_ATTRIBUTE_INHERIT = 0.8;

// ── Building Costs ──
export const BUILDING_COSTS: Record<string, { gold: number; wood: number; iron: number }> = {
  farm:       { gold: 30,  wood: 20,  iron: 0 },
  mine:       { gold: 40,  wood: 10,  iron: 10 },
  lumberMill: { gold: 30,  wood: 10,  iron: 5 },
  market:     { gold: 60,  wood: 30,  iron: 10 },
  barracks:   { gold: 50,  wood: 30,  iron: 20 },
  wall:       { gold: 20,  wood: 15,  iron: 15 },
  library:    { gold: 70,  wood: 20,  iron: 5 },
  tower:      { gold: 50,  wood: 25,  iron: 20 },
  embassy:    { gold: 80,  wood: 20,  iron: 10 },
};

// ── Building Production per Turn ──
export const BUILDING_PRODUCTION: Record<string, Record<string, number>> = {
  farm:       { food: 8 },
  mine:       { iron: 5 },
  lumberMill: { wood: 6 },
  market:     { gold: 10 },
  library:    { knowledge: 4 },
};

// ── Terrain Resource Yield ──
export const TERRAIN_RESOURCE_YIELD: Record<string, Record<string, number>> = {
  plains:     { gold: 2, food: 3 },
  forest:     { wood: 4, food: 2 },
  mountains:  { iron: 3, gold: 1 },
  desert:     { gold: 1 },
  water:      {},
  tundra:     { iron: 1 },
  jungle:     { wood: 3, food: 3 },
  swamp:      { food: 1 },
};

// ── Resource Depletion ──
export const INITIAL_RICHNESS = 100;
export const GATHER_DRAIN_RATE = 3;
export const REGEN_RATE = 0.5;
export const DEPLETED_THRESHOLD = 10;

// ── Terrain Combat Modifiers ──
export const TERRAIN_ATTACK_MOD: Record<string, number> = {
  plains: 0, forest: -5, mountains: -10, desert: -3, water: -15,
  tundra: -5, jungle: -8, swamp: -10,
};
export const TERRAIN_DEFENSE_MOD: Record<string, number> = {
  plains: 0, forest: 10, mountains: 15, desert: -5, water: -10,
  tundra: 5, jungle: 8, swamp: -5,
};

// ── Training ──
export const TRAIN_COST = { gold: 15, food: 10 };
export const TRAIN_PER_BARRACKS = 3;

// ── Research Cost ──
export const RESEARCH_COST = { knowledge: 20, gold: 30 };
export const RESEARCH_BOOST = 3;

// ── Win Conditions ──
export const WIN_TERRITORY_PERCENT = 0.5;
export const MAX_TURNS = 300;

// ── Wall / Tower / Fortify ──
export const WALL_DEFENSE_BONUS = 20;
export const TOWER_VISION_RANGE = 5;
export const FORTIFY_DEFENSE_BONUS = 15;

// ── Diplomacy ──
export const PEACE_TREATY_DURATION = 15;
export const ALLIANCE_DURATION = 25;
export const BETRAYAL_REPUTATION_PENALTY = 30;

// ── Food Upkeep ──
export const FOOD_PER_UNIT = 0.2;
export const STARVATION_LOSS_PERCENT = 0.15;

// ── 10 Agent Starting Positions (spread across 50x30) ──
export const STARTING_POSITIONS = [
  { x: 3,  y: 3 },
  { x: 14, y: 2 },
  { x: 35, y: 3 },
  { x: 46, y: 4 },
  { x: 5,  y: 15 },
  { x: 25, y: 14 },
  { x: 44, y: 15 },
  { x: 8,  y: 26 },
  { x: 28, y: 25 },
  { x: 42, y: 26 },
];

// ── Agent Names & Colors ──
export const AGENT_NAMES = [
  'Axiom', 'Beacon', 'Cipher', 'Drift', 'Echo',
  'Forge', 'Glyph', 'Helix', 'Ion', 'Jade',
];

export const AGENT_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7',
  '#ec4899', '#f97316', '#06b6d4', '#84cc16', '#6366f1',
];
