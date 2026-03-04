import { useRef, useEffect, useState, useCallback } from 'react';
import { MapCell, Agent, DiplomaticRelation } from '../types';

interface Props {
  map: MapCell[][];
  agents: Agent[];
  diplomacy?: Record<string, DiplomaticRelation>;
  onCellClick?: (cell: MapCell) => void;
}

// ── Isometric tile dimensions ──
const TILE_W = 32;       // tile width
const TILE_H = 16;       // tile height (half of width for isometric)
const TILE_DEPTH = 10;   // block side height
const WATER_ANIM_SPEED = 0.002;

// ── Terrain height levels ──
const TERRAIN_HEIGHT: Record<string, number> = {
  water: 0, swamp: 1, plains: 2, desert: 2, forest: 2,
  jungle: 2, tundra: 3, mountains: 5,
};

// ── Terrain top face colors (base) ──
const TERRAIN_TOP: Record<string, [number, number, number]> = {
  plains:    [106, 168, 79],
  forest:    [56, 118, 41],
  mountains: [142, 131, 120],
  water:     [41, 98, 168],
  desert:    [210, 180, 100],
  tundra:    [175, 195, 210],
  jungle:    [36, 130, 56],
  swamp:     [82, 105, 65],
};

// ── Terrain side face colors (darker) ──
const TERRAIN_SIDE: Record<string, [number, number, number]> = {
  plains:    [78, 130, 58],
  forest:    [42, 90, 30],
  mountains: [105, 95, 85],
  water:     [30, 72, 130],
  desert:    [175, 145, 75],
  tundra:    [140, 160, 175],
  jungle:    [26, 98, 42],
  swamp:     [60, 80, 48],
};

// ── Terrain front face colors (even darker) ──
const TERRAIN_FRONT: Record<string, [number, number, number]> = {
  plains:    [62, 105, 45],
  forest:    [32, 72, 22],
  mountains: [85, 75, 68],
  water:     [22, 55, 100],
  desert:    [148, 120, 58],
  tundra:    [115, 132, 148],
  jungle:    [20, 78, 32],
  swamp:     [45, 62, 36],
};

function rgb(c: [number, number, number], a = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function mixColor(c: [number, number, number], factor: number): [number, number, number] {
  return [
    Math.min(255, Math.floor(c[0] * factor)),
    Math.min(255, Math.floor(c[1] * factor)),
    Math.min(255, Math.floor(c[2] * factor)),
  ];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Convert grid (x,y) to screen position (isometric)
function toScreen(x: number, y: number, h: number, offsetX: number, offsetY: number): [number, number] {
  const sx = (x - y) * (TILE_W / 2) + offsetX;
  const sy = (x + y) * (TILE_H / 2) - h * TILE_DEPTH + offsetY;
  return [sx, sy];
}

export function GameMap({ map, agents, diplomacy, onCellClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCell, setHoveredCell] = useState<MapCell | null>(null);
  const animFrameRef = useRef(0);
  const timeRef = useRef(0);

  const agentColorMap = new Map(agents.map(a => [a.id, a.color]));
  const agentNameMap = new Map(agents.map(a => [a.id, a.name]));
  const rows = map.length;
  const cols = map[0]?.length || 0;

  // Canvas dimensions
  const canvasW = (cols + rows) * (TILE_W / 2) + 40;
  const canvasH = (cols + rows) * (TILE_H / 2) + 12 * TILE_DEPTH + 60;
  const offsetX = rows * (TILE_W / 2) + 10;
  const offsetY = 40;

  const drawFrame = useCallback((ctx: CanvasRenderingContext2D, time: number) => {
    ctx.clearRect(0, 0, canvasW, canvasH);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvasH);
    bgGrad.addColorStop(0, '#0c1a2e');
    bgGrad.addColorStop(1, '#0a0e1a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw tiles back-to-front (isometric sort)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cell = map[y][x];
        let h = TERRAIN_HEIGHT[cell.terrain] || 2;

        // Water animation
        const isWater = cell.terrain === 'water';
        if (isWater) {
          h = 0.3 + Math.sin(time * WATER_ANIM_SPEED + x * 0.5 + y * 0.3) * 0.3;
        }

        const [sx, sy] = toScreen(x, y, h, offsetX, offsetY);

        // ── Draw isometric block ──
        let topColor = TERRAIN_TOP[cell.terrain] || [100, 100, 100];
        let sideColor = TERRAIN_SIDE[cell.terrain] || [70, 70, 70];
        let frontColor = TERRAIN_FRONT[cell.terrain] || [55, 55, 55];

        // Richness-based tint (depleted = darker/browner)
        if (!isWater && cell.richness < 60) {
          const depletion = 1 - (60 - cell.richness) * 0.008;
          topColor = mixColor(topColor, depletion);
          sideColor = mixColor(sideColor, depletion);
          frontColor = mixColor(frontColor, depletion);
        }

        // Water: animated color
        if (isWater) {
          const wave = Math.sin(time * 0.001 + x * 0.8 + y * 0.6) * 0.15 + 1;
          topColor = mixColor(topColor, wave);
          // Water specular highlight
          const spec = Math.max(0, Math.sin(time * 0.0015 + x * 1.2 - y * 0.7));
          if (spec > 0.7) {
            topColor = [
              Math.min(255, topColor[0] + Math.floor(spec * 60)),
              Math.min(255, topColor[1] + Math.floor(spec * 60)),
              Math.min(255, topColor[2] + Math.floor(spec * 80)),
            ];
          }
        }

        // ── Top face (diamond) ──
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
        ctx.lineTo(sx, sy + TILE_H);
        ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2);
        ctx.closePath();
        ctx.fillStyle = rgb(topColor);
        ctx.fill();

        // ── Right side face ──
        const sideH = Math.max(TILE_DEPTH, h * TILE_DEPTH * 0.5 + TILE_DEPTH);
        ctx.beginPath();
        ctx.moveTo(sx + TILE_W / 2, sy + TILE_H / 2);
        ctx.lineTo(sx, sy + TILE_H);
        ctx.lineTo(sx, sy + TILE_H + sideH);
        ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2 + sideH);
        ctx.closePath();
        ctx.fillStyle = rgb(sideColor);
        ctx.fill();

        // ── Left side face ──
        ctx.beginPath();
        ctx.moveTo(sx - TILE_W / 2, sy + TILE_H / 2);
        ctx.lineTo(sx, sy + TILE_H);
        ctx.lineTo(sx, sy + TILE_H + sideH);
        ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2 + sideH);
        ctx.closePath();
        ctx.fillStyle = rgb(frontColor);
        ctx.fill();

        // ── Owner territory overlay (strong colors) ──
        if (cell.owner) {
          const ownerColor = hexToRgb(agentColorMap.get(cell.owner) || '#666');

          // Strong tinted top face
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
          ctx.lineTo(sx, sy + TILE_H);
          ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2);
          ctx.closePath();
          ctx.fillStyle = rgb(ownerColor, 0.45);
          ctx.fill();

          // Tint side faces too
          ctx.beginPath();
          ctx.moveTo(sx + TILE_W / 2, sy + TILE_H / 2);
          ctx.lineTo(sx, sy + TILE_H);
          ctx.lineTo(sx, sy + TILE_H + sideH);
          ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2 + sideH);
          ctx.closePath();
          ctx.fillStyle = rgb(ownerColor, 0.25);
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(sx - TILE_W / 2, sy + TILE_H / 2);
          ctx.lineTo(sx, sy + TILE_H);
          ctx.lineTo(sx, sy + TILE_H + sideH);
          ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2 + sideH);
          ctx.closePath();
          ctx.fillStyle = rgb(ownerColor, 0.2);
          ctx.fill();

          // Territory border: check neighbors — thicker glowing borders
          const borderColor = rgb(ownerColor, 0.95);
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = 2;
          ctx.shadowColor = rgb(ownerColor, 0.6);
          ctx.shadowBlur = 3;
          // Top edge (y-1)
          if (y === 0 || map[y - 1][x].owner !== cell.owner) {
            ctx.beginPath();
            ctx.moveTo(sx - TILE_W / 2, sy + TILE_H / 2);
            ctx.lineTo(sx, sy);
            ctx.stroke();
          }
          // Right edge (x+1)
          if (x === cols - 1 || map[y][x + 1].owner !== cell.owner) {
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + TILE_W / 2, sy + TILE_H / 2);
            ctx.stroke();
          }
          // Bottom edge (y+1)
          if (y === rows - 1 || map[y + 1][x].owner !== cell.owner) {
            ctx.beginPath();
            ctx.moveTo(sx + TILE_W / 2, sy + TILE_H / 2);
            ctx.lineTo(sx, sy + TILE_H);
            ctx.stroke();
          }
          // Left edge (x-1)
          if (x === 0 || map[y][x - 1].owner !== cell.owner) {
            ctx.beginPath();
            ctx.moveTo(sx, sy + TILE_H);
            ctx.lineTo(sx - TILE_W / 2, sy + TILE_H / 2);
            ctx.stroke();
          }
          ctx.shadowBlur = 0;
        }

        // ── Trees on forest/jungle ──
        if (cell.terrain === 'forest' || cell.terrain === 'jungle') {
          drawTree(ctx, sx, sy - 2, cell.terrain === 'jungle');
        }

        // ── Snow caps on mountains ──
        if (cell.terrain === 'mountains') {
          drawMountainPeak(ctx, sx, sy);
        }

        // ── Swamp bubbles ──
        if (cell.terrain === 'swamp') {
          const bubblePhase = Math.sin(time * 0.002 + x * 3 + y * 7);
          if (bubblePhase > 0.8) {
            ctx.beginPath();
            ctx.arc(sx - 3 + (x % 3) * 3, sy + 4, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(120,150,100,0.5)';
            ctx.fill();
          }
        }

        // ── Buildings ──
        if (cell.building) {
          drawBuilding(ctx, sx, sy, cell.building.type, cell.owner ? agentColorMap.get(cell.owner) || '#888' : '#888');
        }

        // ── Units ──
        if (cell.units > 0) {
          drawUnits(ctx, sx, sy, cell.units, cell.owner ? agentColorMap.get(cell.owner) || '#fff' : '#fff');
        }
      }
    }
  }, [map, agents, rows, cols, canvasW, canvasH, offsetX, offsetY, agentColorMap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasW;
    canvas.height = canvasH;

    let running = true;
    const animate = (t: number) => {
      if (!running) return;
      timeRef.current = t;
      drawFrame(ctx, t);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [drawFrame, canvasW, canvasH]);

  // Hit testing for hover
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    // Reverse isometric transform (approximate)
    const rx = mx - offsetX;
    const ry = my - offsetY;
    const gx = Math.floor((rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2);
    const gy = Math.floor((ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2);

    if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
      setHoveredCell(map[gy][gx]);
    } else {
      setHoveredCell(null);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const rx = mx - offsetX;
    const ry = my - offsetY;
    const gx = Math.floor((rx / (TILE_W / 2) + ry / (TILE_H / 2)) / 2);
    const gy = Math.floor((ry / (TILE_H / 2) - rx / (TILE_W / 2)) / 2);

    if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
      onCellClick?.(map[gy][gx]);
    }
  };

  const ownerName = hoveredCell?.owner ? agentNameMap.get(hoveredCell.owner) || hoveredCell.owner : null;
  const ownerColor = hoveredCell?.owner ? agentColorMap.get(hoveredCell.owner) : null;

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredCell(null)}
        onClick={handleClick}
        style={{
          borderRadius: 12,
          cursor: 'pointer',
          width: '100%',
          maxWidth: canvasW,
          imageRendering: 'pixelated',
        }}
      />
      {hoveredCell && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(10,10,26,0.95)', padding: '8px 18px', borderRadius: 10,
          fontSize: 11, color: '#ddd', textAlign: 'center', whiteSpace: 'nowrap',
          border: ownerColor ? `1px solid ${ownerColor}55` : '1px solid #333',
          backdropFilter: 'blur(8px)',
          boxShadow: ownerColor ? `0 0 12px ${ownerColor}22` : 'none',
        }}>
          <b>({hoveredCell.x},{hoveredCell.y})</b> {hoveredCell.terrain}
          {' '} | Richness: <span style={{ color: hoveredCell.richness > 50 ? '#4ade80' : '#ef4444' }}>{Math.round(hoveredCell.richness)}%</span>
          {ownerName ? (
            <span> | <span style={{ color: ownerColor || '#888', fontWeight: 700 }}>{ownerName}</span></span>
          ) : ' | neutral'}
          {hoveredCell.building ? ` | ${hoveredCell.building.type}` : ''}
          {hoveredCell.units > 0 ? ` | ${hoveredCell.units} units` : ''}
          <span style={{ color: '#555', marginLeft: 6, fontSize: 9 }}>click to inspect</span>
        </div>
      )}
    </div>
  );
}

// ── Drawing helpers ──

function drawTree(ctx: CanvasRenderingContext2D, sx: number, sy: number, isJungle: boolean) {
  const green = isJungle ? [20, 100, 35] : [45, 110, 40];
  const darkGreen = isJungle ? [12, 70, 22] : [30, 80, 25];

  // Trunk
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(sx - 1, sy - 4, 2, 5);

  // Canopy (layered triangles)
  ctx.beginPath();
  ctx.moveTo(sx, sy - 12);
  ctx.lineTo(sx + 5, sy - 3);
  ctx.lineTo(sx - 5, sy - 3);
  ctx.closePath();
  ctx.fillStyle = rgb(green as [number, number, number]);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(sx, sy - 9);
  ctx.lineTo(sx + 4, sy - 2);
  ctx.lineTo(sx - 4, sy - 2);
  ctx.closePath();
  ctx.fillStyle = rgb(darkGreen as [number, number, number]);
  ctx.fill();
}

function drawMountainPeak(ctx: CanvasRenderingContext2D, sx: number, sy: number) {
  // Snow cap
  ctx.beginPath();
  ctx.moveTo(sx, sy - 3);
  ctx.lineTo(sx + 4, sy + 2);
  ctx.lineTo(sx - 4, sy + 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(240,245,255,0.8)';
  ctx.fill();
}

function drawBuilding(ctx: CanvasRenderingContext2D, sx: number, sy: number, type: string, color: string) {
  const c = hexToRgb(color);
  const bx = sx - 5;
  const by = sy - 10;

  switch (type) {
    case 'farm': {
      // Wheat field
      ctx.fillStyle = '#c9a84c';
      ctx.fillRect(bx, by + 6, 10, 4);
      ctx.fillStyle = '#a8882a';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(bx + 1 + i * 2.5, by + 2, 1, 6);
      }
      break;
    }
    case 'barracks': {
      // Military tent
      ctx.fillStyle = rgb(mixColor(c, 0.8));
      ctx.beginPath();
      ctx.moveTo(sx, by);
      ctx.lineTo(sx + 6, by + 8);
      ctx.lineTo(sx - 6, by + 8);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = rgb(mixColor(c, 0.5));
      ctx.fillRect(sx - 6, by + 8, 12, 3);
      break;
    }
    case 'wall': {
      // Stone wall
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(bx, by + 2, 10, 8);
      ctx.fillStyle = '#6a6a6a';
      ctx.fillRect(bx, by + 2, 10, 2);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(bx + 1, by + 4, 3, 2);
      ctx.fillRect(bx + 6, by + 4, 3, 2);
      break;
    }
    case 'tower': {
      // Watchtower
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(sx - 2, by - 4, 4, 14);
      ctx.fillStyle = rgb(mixColor(c, 0.9));
      ctx.fillRect(sx - 4, by - 6, 8, 3);
      ctx.fillStyle = '#eee';
      ctx.fillRect(sx - 1, by - 3, 2, 2);
      break;
    }
    case 'market': {
      // Market stall with awning
      ctx.fillStyle = rgb(mixColor(c, 0.7));
      ctx.beginPath();
      ctx.moveTo(sx - 6, by + 2);
      ctx.lineTo(sx + 6, by + 2);
      ctx.lineTo(sx + 5, by + 5);
      ctx.lineTo(sx - 5, by + 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(sx - 4, by + 5, 8, 5);
      break;
    }
    case 'library': {
      // Library with dome
      ctx.fillStyle = '#6a5a8a';
      ctx.fillRect(sx - 5, by + 3, 10, 7);
      ctx.beginPath();
      ctx.arc(sx, by + 3, 5, Math.PI, 0);
      ctx.fillStyle = '#8a7aaa';
      ctx.fill();
      ctx.fillStyle = '#ddd';
      ctx.fillRect(sx - 1, by + 5, 2, 4);
      break;
    }
    case 'mine': {
      // Mine entrance
      ctx.fillStyle = '#5a4a3a';
      ctx.beginPath();
      ctx.arc(sx, by + 6, 5, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#2a1a0a';
      ctx.beginPath();
      ctx.arc(sx, by + 6, 3, Math.PI, 0);
      ctx.fill();
      break;
    }
    case 'lumberMill': {
      // Sawmill
      ctx.fillStyle = '#7a5a2a';
      ctx.fillRect(sx - 5, by + 3, 10, 7);
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(sx - 6, by + 1, 12, 3);
      // Saw blade
      ctx.strokeStyle = '#ccc';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx + 3, by + 6, 3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'embassy': {
      // Embassy with flag
      ctx.fillStyle = '#f0e8d8';
      ctx.fillRect(sx - 5, by + 2, 10, 8);
      ctx.fillStyle = '#d0c8b8';
      ctx.fillRect(sx - 6, by, 12, 3);
      // Flag
      ctx.fillStyle = rgb(c);
      ctx.fillRect(sx + 3, by - 6, 5, 3);
      ctx.fillStyle = '#555';
      ctx.fillRect(sx + 3, by - 6, 1, 8);
      break;
    }
    default: {
      ctx.fillStyle = '#888';
      ctx.fillRect(bx + 1, by + 2, 8, 8);
    }
  }
}

function drawUnits(ctx: CanvasRenderingContext2D, sx: number, sy: number, count: number, color: string) {
  const c = hexToRgb(color);

  // Unit banner/flag
  const bx = sx + 7;
  const by = sy - 2;

  // Banner background
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.roundRect(bx - 1, by - 1, count >= 10 ? 14 : 10, 10, 3);
  ctx.fill();

  // Banner color stripe
  ctx.fillStyle = rgb(c, 0.8);
  ctx.fillRect(bx, by, 2, 8);

  // Count text
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(String(count), bx + 4, by + 4);
}
