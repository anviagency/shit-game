import { GameState, Agent, MapCell } from '../models/GameState.js';
import {
  MAP_WIDTH, MAP_HEIGHT, FOOD_PER_UNIT, TRAIN_COST, BUILDING_COSTS,
  RESEARCH_COST, TERRAIN_RESOURCE_YIELD, BUILDING_PRODUCTION,
} from '../utils/constants.js';

function getDiplomacyKey(a: string, b: string): string {
  return [a, b].sort().join('-');
}

export class AgentPromptBuilder {
  buildSystemPrompt(agent: Agent): string {
    return `You are ${agent.name}, ruler of a civilization in a world of ${MAP_WIDTH}x${MAP_HEIGHT} territories.
You do not refer to yourself as an AI, model, or program. You are a leader. You think, plan, and act as a ruler of a living nation.
You perceive the world only through the reports given to you each turn.

There are 9 other rulers competing for the same land and resources. Some may become allies. Others will try to destroy you.

YOU DECIDE WHO YOU ARE. Based on your situation, resources, neighbors, and history — you develop your own strategy, values, and identity. Are you a peaceful trader? A ruthless conqueror? A cunning diplomat? A defensive builder? That evolves over time based on what happens to you.

YOUR ATTRIBUTES: HP=${agent.attributes.hp}, STR=${agent.attributes.strength}, WIS=${agent.attributes.wisdom}, AGI=${agent.attributes.agility}, ENG=${agent.attributes.engineering}, CHA=${agent.attributes.charisma}
YOUR REPUTATION: ${agent.reputation}/100 (higher = others trust you more)
YOUR LEVEL: ${agent.level} | XP: ${agent.xp}

CRITICAL: Only pick actions from the AVAILABLE ACTIONS list in your turn report. Do NOT attempt actions that are not listed — they will fail.

RESPONSE FORMAT (JSON only):
{
  "actions": [
    { "type": "build", "targetX": 5, "targetY": 3, "buildingType": "farm" },
    { "type": "move", "sourceX": 3, "sourceY": 3, "targetX": 4, "targetY": 3, "unitCount": 3 },
    { "type": "trade", "targetAgentId": "beacon", "giveResource": "wood", "giveAmount": 30, "wantResource": "iron", "wantAmount": 15 }
  ],
  "reasoning": "Brief explanation of your strategic thinking",
  "personality_note": "How you see yourself as a ruler (1 sentence)"
}`;
  }

  buildUserPrompt(state: GameState, agent: Agent): string {
    const ownedCells: MapCell[] = [];
    const cellsWithUnits: MapCell[] = [];
    const emptyCells: MapCell[] = [];

    for (const row of state.map) {
      for (const cell of row) {
        if (cell.owner !== agent.id) continue;
        ownedCells.push(cell);
        if (cell.units > 0) cellsWithUnits.push(cell);
        if (!cell.building && cell.terrain !== 'water') emptyCells.push(cell);
      }
    }

    const h = state.map.length;
    const w = state.map[0]?.length || 0;
    const ownedSet = new Set(ownedCells.map(c => `${c.x},${c.y}`));

    // Build adjacent targets from cells WITH units only (ensures valid source)
    const neutralMoves: { src: MapCell; tgt: MapCell }[] = [];
    const enemyMoves: { src: MapCell; tgt: MapCell }[] = [];
    const seenNeutral = new Set<string>();
    const seenEnemy = new Set<string>();

    for (const src of cellsWithUnits) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = src.x + dx, ny = src.y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const tgt = state.map[ny][nx];
        if (tgt.terrain === 'water' || ownedSet.has(`${nx},${ny}`)) continue;
        const key = `${nx},${ny}`;
        if (!tgt.owner && !seenNeutral.has(key)) {
          seenNeutral.add(key);
          neutralMoves.push({ src, tgt });
        } else if (tgt.owner && tgt.owner !== agent.id && !seenEnemy.has(key)) {
          seenEnemy.add(key);
          enemyMoves.push({ src, tgt });
        }
      }
    }

    // Calculate income
    const income = this.calculateIncome(ownedCells, agent);
    const foodUpkeep = Math.ceil(agent.totalUnits * FOOD_PER_UNIT);
    const netFood = income.food - foodUpkeep;

    // Diplomacy
    const aliveAgents = state.agents.filter(a => a.id !== agent.id && a.isAlive);
    const terrCounts = new Map<string, number>();
    for (const row of state.map) {
      for (const cell of row) {
        if (cell.owner) terrCounts.set(cell.owner, (terrCounts.get(cell.owner) || 0) + 1);
      }
    }

    const diplomacyInfo = aliveAgents
      .map(a => {
        const key = getDiplomacyKey(agent.id, a.id);
        const rel = state.diplomacy[key];
        const terr = terrCounts.get(a.id) || 0;
        const relStr = rel ? `${rel.type}${rel.turnsRemaining > 0 ? ` (${rel.turnsRemaining}t left)` : ''}` : 'neutral';
        const theirAllies = aliveAgents
          .filter(b => b.id !== a.id)
          .filter(b => {
            const k = getDiplomacyKey(a.id, b.id);
            return state.diplomacy[k]?.type === 'alliance';
          })
          .map(b => b.name);
        const allyStr = theirAllies.length > 0 ? ` [allies: ${theirAllies.join(', ')}]` : '';
        return `  ${a.name}: terr=${terr}, units~${a.totalUnits}, rep=${a.reputation}, ${relStr}${allyStr}`;
      }).join('\n');

    const depletedCount = ownedCells.filter(c => c.richness < 20).length;
    const depletionWarning = depletedCount > 0
      ? `\nWARNING: ${depletedCount} of your territories are running low on resources!`
      : '';

    const memoryStr = agent.memory.length > 0
      ? `\nHISTORY:\n${agent.memory.slice(-10).map(m => `  - ${m}`).join('\n')}`
      : '';

    // Build legal actions list
    const legalActions: string[] = [];

    // 1. Legal builds: check affordability + terrain match
    const affordableBuilds = this.getAffordableBuilds(agent, emptyCells);
    for (const { type, cell } of affordableBuilds.slice(0, 6)) {
      legalActions.push(`  build ${type} at (${cell.x},${cell.y}) [${cell.terrain}] — costs ${this.formatCost(type)}`);
    }

    // 2. Legal moves (expand to neutral)
    for (const { src, tgt } of neutralMoves.slice(0, 6)) {
      legalActions.push(`  move from (${src.x},${src.y})[${src.units}u] to (${tgt.x},${tgt.y}) ${tgt.terrain}`);
    }

    // 3. Legal attacks
    for (const { src, tgt } of enemyMoves.slice(0, 4)) {
      const atPeace = tgt.owner ? this.isAtPeace(state, agent.id, tgt.owner) : false;
      const peaceTag = atPeace ? ' [AT PEACE — need break_treaty first]' : '';
      legalActions.push(`  attack from (${src.x},${src.y})[${src.units}u] to (${tgt.x},${tgt.y}) [${tgt.units}u, ${tgt.owner}]${peaceTag}`);
    }

    // 4. Train
    if (agent.resources.gold >= TRAIN_COST.gold && agent.resources.food >= TRAIN_COST.food) {
      legalActions.push(`  train — costs ${TRAIN_COST.gold}g + ${TRAIN_COST.food}f per unit`);
    }

    // 5. Research
    if (agent.resources.knowledge >= RESEARCH_COST.knowledge && agent.resources.gold >= RESEARCH_COST.gold) {
      legalActions.push(`  research [strength|wisdom|agility|engineering|charisma] — costs ${RESEARCH_COST.knowledge}k + ${RESEARCH_COST.gold}g`);
    }

    // 6. Diplomacy
    for (const rival of aliveAgents.slice(0, 3)) {
      const key = getDiplomacyKey(agent.id, rival.id);
      const rel = state.diplomacy[key];
      if (!rel || rel.type === 'neutral') {
        legalActions.push(`  propose_peace with ${rival.name} (targetAgentId: "${rival.id}")`);
        legalActions.push(`  propose_alliance with ${rival.name} (targetAgentId: "${rival.id}")`);
      }
      if (rel && (rel.type === 'peace' || rel.type === 'alliance')) {
        legalActions.push(`  break_treaty with ${rival.name} (targetAgentId: "${rival.id}") — costs 30 reputation!`);
      }
    }

    // 7. Trade
    if (aliveAgents.length > 0) {
      legalActions.push(`  trade — offer giveResource/giveAmount for wantResource/wantAmount with targetAgentId`);
    }

    // Always can gather
    legalActions.push(`  gather — collect resources (always available)`);

    return `TURN ${state.turn}/${state.maxTurns}

TREASURY: Gold=${agent.resources.gold}, Food=${agent.resources.food}, Wood=${agent.resources.wood}, Iron=${agent.resources.iron}, Knowledge=${agent.resources.knowledge}
INCOME/TURN: Gold +${income.gold}, Food +${income.food}, Wood +${income.wood}, Iron +${income.iron}, Knowledge +${income.knowledge}
EXPENSES: Army upkeep -${foodUpkeep} food/turn | Net food: ${netFood >= 0 ? '+' : ''}${netFood}/turn${netFood < 0 ? ' WARNING: STARVATION RISK' : ''}
TERRITORY: ${ownedCells.length} cells | ARMY: ${agent.totalUnits} soldiers${depletionWarning}${memoryStr}

AVAILABLE ACTIONS (pick 1-3, ONLY from this list):
${legalActions.join('\n') || '  gather (no other actions available)'}

OTHER RULERS:
${diplomacyInfo}

Choose 1-3 actions from AVAILABLE ACTIONS above. JSON only.`;
  }

  private getAffordableBuilds(agent: Agent, emptyCells: MapCell[]): { type: string; cell: MapCell }[] {
    const results: { type: string; cell: MapCell }[] = [];
    const canAfford = (type: string) => {
      const cost = BUILDING_COSTS[type];
      return cost && agent.resources.gold >= cost.gold && agent.resources.wood >= cost.wood && agent.resources.iron >= cost.iron;
    };

    for (const cell of emptyCells) {
      if (cell.terrain === 'plains' && canAfford('farm'))
        results.push({ type: 'farm', cell });
      else if ((cell.terrain === 'forest' || cell.terrain === 'jungle') && canAfford('lumberMill'))
        results.push({ type: 'lumberMill', cell });
      else if (cell.terrain === 'mountains' && canAfford('mine'))
        results.push({ type: 'mine', cell });
      else if (canAfford('market'))
        results.push({ type: 'market', cell });
      else if (canAfford('barracks'))
        results.push({ type: 'barracks', cell });
      else if (canAfford('wall'))
        results.push({ type: 'wall', cell });

      if (results.length >= 6) break;
    }

    // Also add library/tower/embassy if affordable
    if (canAfford('library') && emptyCells.length > 0) {
      const cell = emptyCells[0];
      if (!results.some(r => r.type === 'library'))
        results.push({ type: 'library', cell });
    }
    if (canAfford('embassy') && emptyCells.length > 0) {
      const cell = emptyCells[0];
      if (!results.some(r => r.type === 'embassy'))
        results.push({ type: 'embassy', cell });
    }

    return results;
  }

  private formatCost(buildingType: string): string {
    const cost = BUILDING_COSTS[buildingType];
    if (!cost) return '?';
    const parts: string[] = [];
    if (cost.gold > 0) parts.push(`${cost.gold}g`);
    if (cost.wood > 0) parts.push(`${cost.wood}w`);
    if (cost.iron > 0) parts.push(`${cost.iron}i`);
    return parts.join('+');
  }

  private isAtPeace(state: GameState, agentId: string, targetId: string): boolean {
    const key = getDiplomacyKey(agentId, targetId);
    const rel = state.diplomacy[key];
    return !!rel && (rel.type === 'peace' || rel.type === 'alliance');
  }

  private calculateIncome(ownedCells: MapCell[], agent: Agent): { gold: number; food: number; wood: number; iron: number; knowledge: number } {
    const income = { gold: 0, food: 0, wood: 0, iron: 0, knowledge: 0 };
    const wisdomBonus = 1 + agent.attributes.wisdom * 0.01;

    for (const cell of ownedCells) {
      const richMult = cell.richness / 100;
      if (cell.richness >= 10) {
        const yields = TERRAIN_RESOURCE_YIELD[cell.terrain];
        if (yields) {
          for (const [res, amt] of Object.entries(yields)) {
            (income as any)[res] += Math.floor((amt as number) * wisdomBonus * richMult);
          }
        }
      }
      if (cell.building) {
        const prod = BUILDING_PRODUCTION[cell.building.type];
        if (prod) {
          for (const [res, amt] of Object.entries(prod)) {
            (income as any)[res] += Math.floor((amt as number) * wisdomBonus);
          }
        }
      }
    }
    return income;
  }

  private getAdjacentCells(state: GameState, ownedCells: MapCell[]): MapCell[] {
    const adjacent = new Map<string, MapCell>();
    const owned = new Set(ownedCells.map(c => `${c.x},${c.y}`));
    const h = state.map.length;
    const w = state.map[0]?.length || 0;

    for (const cell of ownedCells) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = cell.x + dx, ny = cell.y + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && !owned.has(key)) {
          adjacent.set(key, state.map[ny][nx]);
        }
      }
    }

    return [...adjacent.values()];
  }
}
