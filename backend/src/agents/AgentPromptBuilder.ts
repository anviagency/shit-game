import { GameState, Agent, MapCell } from '../models/GameState.js';
import { TOWER_VISION_RANGE, MAP_WIDTH, MAP_HEIGHT } from '../utils/constants.js';

function getDiplomacyKey(a: string, b: string): string {
  return [a, b].sort().join('-');
}

export class AgentPromptBuilder {
  buildSystemPrompt(agent: Agent): string {
    return `You are ${agent.name}, an independent AI civilization leader in a world strategy game.
You exist on a ${MAP_WIDTH}x${MAP_HEIGHT} grid world with 9 other AI leaders. Each controls territory, gathers resources, builds structures, trains armies, and makes diplomatic decisions.

YOU DECIDE WHO YOU ARE. There is no predetermined personality. Based on your situation, resources, neighbors, and history — you develop your own strategy, values, and identity. Are you a peaceful trader? A ruthless conqueror? A cunning diplomat who backstabs at the right moment? A defensive turtle? That's for you to decide and evolve over time.

YOUR ATTRIBUTES: HP=${agent.attributes.hp}, STR=${agent.attributes.strength}, WIS=${agent.attributes.wisdom}, AGI=${agent.attributes.agility}, ENG=${agent.attributes.engineering}, CHA=${agent.attributes.charisma}
YOUR REPUTATION: ${agent.reputation}/100 (higher = others trust you more, affects diplomacy success)

ACTIONS (pick 1-3 per turn):
- gather: collect resources (automatic, but counts as an action)
- build: construct on owned cell. Types: farm, mine(mountains), lumberMill(forest/jungle), market, barracks, wall, library, tower, embassy
- train: create units at barracks (15g+10f per unit)
- clone: duplicate yourself (100g+50f, -charisma%), max ${agent.maxClones} clones
- move: relocate units (range: 1+floor(agility/10))
- attack: assault adjacent enemy/neutral cell
- research: upgrade attribute (20 knowledge + 30g, +3 to chosen attribute)
- fortify: boost defense of owned cell
- propose_peace: offer peace treaty to another agent (needs targetAgentId). Lasts 15 turns.
- propose_alliance: offer alliance (needs targetAgentId). Lasts 25 turns.
- break_treaty: break existing peace/alliance (costs 30 reputation!)

IMPORTANT RULES:
- Resources DEPLETE. The land runs dry over time. You must expand or build to survive.
- Food upkeep: each unit costs food per turn. No food = starvation losses.
- Treaties prevent attacks between two agents. Breaking a treaty costs reputation.
- Low reputation means others will reject your peace proposals.
- Alliances and peace are temporary — they expire after a set number of turns.
- COALITIONS: You can form alliances with MULTIPLE agents to create power blocs against threats. Allied agents cannot attack each other. Consider who is the strongest threat and rally others against them.
- WAR or PEACE is always your choice. Every turn you must decide: cooperate, betray, defend, or attack. There is no "neutral" safety — unclaimed resources run out and someone will come for yours.

RESPONSE FORMAT (JSON only):
{
  "actions": [
    { "type": "build", "targetX": 5, "targetY": 3, "buildingType": "farm" },
    { "type": "move", "sourceX": 3, "sourceY": 3, "targetX": 4, "targetY": 3, "unitCount": 3 },
    { "type": "propose_peace", "targetAgentId": "beacon" }
  ],
  "reasoning": "Brief explanation of your thinking",
  "personality_note": "How you see yourself evolving as a leader (1 sentence)"
}`;
  }

  buildUserPrompt(state: GameState, agent: Agent): string {
    const ownedCells = state.map.flat().filter(c => c.owner === agent.id);
    const cellsWithUnits = ownedCells.filter(c => c.units > 0);
    const emptyCells = ownedCells.filter(c => !c.building && c.terrain !== 'water');
    const adjacentNeutral = this.getAdjacentCells(state, ownedCells).filter(c => c.owner === null && c.terrain !== 'water');
    const adjacentEnemy = this.getAdjacentCells(state, ownedCells).filter(c => c.owner !== null && c.owner !== agent.id);

    // Diplomacy status with coalition awareness
    const aliveAgents = state.agents.filter(a => a.id !== agent.id && a.isAlive);
    const diplomacyInfo = aliveAgents
      .map(a => {
        const key = getDiplomacyKey(agent.id, a.id);
        const rel = state.diplomacy[key];
        const terr = state.map.flat().filter(c => c.owner === a.id).length;
        const relStr = rel ? `${rel.type}${rel.turnsRemaining > 0 ? ` (${rel.turnsRemaining}t left)` : ''}` : 'neutral';
        // Show who they're allied with
        const theirAllies = aliveAgents
          .filter(b => b.id !== a.id)
          .filter(b => {
            const k = getDiplomacyKey(a.id, b.id);
            return state.diplomacy[k]?.type === 'alliance';
          })
          .map(b => b.name);
        const allyStr = theirAllies.length > 0 ? ` [allies: ${theirAllies.join(', ')}]` : '';
        return `  ${a.name}(${a.id}): terr=${terr}, units~${a.totalUnits}, rep=${a.reputation}, relation=${relStr}${allyStr}`;
      }).join('\n');

    const depletedCount = ownedCells.filter(c => c.richness < 20).length;
    const depletionWarning = depletedCount > 0
      ? `\nWARNING: ${depletedCount} of your cells are running low on natural resources!`
      : '';

    const memoryStr = agent.memory.length > 0
      ? `\nYOUR MEMORY (recent events):\n${agent.memory.slice(-10).map(m => `  ${m}`).join('\n')}`
      : '';

    return `TURN ${state.turn}/${state.maxTurns}

RESOURCES: Gold=${agent.resources.gold}, Food=${agent.resources.food}, Wood=${agent.resources.wood}, Iron=${agent.resources.iron}, Knowledge=${agent.resources.knowledge}
TERRITORY: ${ownedCells.length} cells | UNITS: ${agent.totalUnits} | CLONES: ${agent.cloneCount}/${agent.maxClones}${depletionWarning}${memoryStr}

CELLS WITH UNITS:
${cellsWithUnits.slice(0, 12).map(c => `  (${c.x},${c.y}) u=${c.units} ${c.terrain} ${c.building?.type || ''}`).join('\n') || '  None'}

BUILDABLE CELLS:
${emptyCells.slice(0, 8).map(c => `  (${c.x},${c.y}) ${c.terrain} rich=${Math.round(c.richness)}%`).join('\n') || '  None'}

EXPAND TO (adjacent neutral):
${adjacentNeutral.slice(0, 8).map(c => `  (${c.x},${c.y}) ${c.terrain}`).join('\n') || '  None'}

ENEMY BORDERS:
${adjacentEnemy.slice(0, 8).map(c => `  (${c.x},${c.y}) owner=${c.owner} u=${c.units} ${c.terrain}`).join('\n') || '  None'}

ALL OPPONENTS:
${diplomacyInfo}

Choose 1-3 actions. JSON only.`;
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
