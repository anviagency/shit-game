import { MapCell, TerrainType } from '../models/GameState.js';
import { MAP_WIDTH, MAP_HEIGHT, STARTING_POSITIONS, BASE_UNITS, INITIAL_RICHNESS } from '../utils/constants.js';

// Simplex-like noise using multiple octaves of sin
function noise2D(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453;
  return s - Math.floor(s);
}

function smoothNoise(x: number, y: number, scale: number, seed: number): number {
  const sx = x / scale, sy = y / scale;
  const ix = Math.floor(sx), iy = Math.floor(sy);
  const fx = sx - ix, fy = sy - iy;
  const a = noise2D(ix, iy, seed);
  const b = noise2D(ix + 1, iy, seed);
  const c = noise2D(ix, iy + 1, seed);
  const d = noise2D(ix + 1, iy + 1, seed);
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function fbm(x: number, y: number, seed: number): number {
  return (
    smoothNoise(x, y, 12, seed) * 0.5 +
    smoothNoise(x, y, 6, seed + 100) * 0.3 +
    smoothNoise(x, y, 3, seed + 200) * 0.2
  );
}

function pickTerrain(elevation: number, moisture: number): TerrainType {
  // Water: low elevation
  if (elevation < 0.3) return 'water';
  // Beach/desert: low elevation + low moisture
  if (elevation < 0.38 && moisture < 0.4) return 'desert';
  // Swamp: low elevation + high moisture
  if (elevation < 0.4 && moisture > 0.6) return 'swamp';
  // Mountains: high elevation
  if (elevation > 0.75) return 'mountains';
  // Tundra: high elevation + low moisture
  if (elevation > 0.65 && moisture < 0.35) return 'tundra';
  // Jungle: medium elevation + very high moisture
  if (moisture > 0.65) return 'jungle';
  // Forest: medium moisture
  if (moisture > 0.45) return 'forest';
  // Plains: everything else
  return 'plains';
}

export function generateMap(agentIds: string[]): MapCell[][] {
  const seed = Math.random() * 10000;
  const moistureSeed = seed + 500;
  const map: MapCell[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    const row: MapCell[] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      // Create island-like shape: lower elevation at edges
      const edgeX = Math.abs(x - MAP_WIDTH / 2) / (MAP_WIDTH / 2);
      const edgeY = Math.abs(y - MAP_HEIGHT / 2) / (MAP_HEIGHT / 2);
      const edgeFade = 1 - Math.max(edgeX, edgeY) * 0.6;

      const elevation = fbm(x, y, seed) * edgeFade;
      const moisture = fbm(x, y, moistureSeed);

      row.push({
        x, y,
        terrain: pickTerrain(elevation, moisture),
        owner: null,
        building: null,
        units: 0,
        richness: INITIAL_RICHNESS,
      });
    }
    map.push(row);
  }

  // Ensure starting positions are land
  agentIds.forEach((agentId, i) => {
    if (i >= STARTING_POSITIONS.length) return;
    const pos = STARTING_POSITIONS[i];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cy = pos.y + dy, cx = pos.x + dx;
        if (cy >= 0 && cy < MAP_HEIGHT && cx >= 0 && cx < MAP_WIDTH) {
          const cell = map[cy][cx];
          if (cell.terrain === 'water' || cell.terrain === 'swamp') {
            cell.terrain = 'plains';
          }
          cell.owner = agentId;
          cell.richness = INITIAL_RICHNESS;
          // Spread units: 2 on center, 1 on each border cell (total = 2 + 8*1 = 10)
          if (dy === 0 && dx === 0) {
            cell.units = 2;
          } else {
            cell.units = 1;
          }
        }
      }
    }
  });

  return map;
}
