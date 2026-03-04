import { GameState, Agent, Action, TurnDecision } from '../models/GameState.js';
import { LLMProvider } from './LLMProvider.js';
import { AgentPromptBuilder } from './AgentPromptBuilder.js';
import { ActionValidator } from './ActionValidator.js';
import { logger } from '../utils/logger.js';
import { MAX_CLONES } from '../utils/constants.js';

function getDiplomacyKey(a: string, b: string): string {
  return [a, b].sort().join('-');
}

export interface ActionResult {
  actions: Action[];
  reasoning: string;
}

export class AgentManager {
  private providers: Map<string, LLMProvider> = new Map();
  private promptBuilder = new AgentPromptBuilder();
  private validator = new ActionValidator();
  private useMockLLM: boolean;

  // Store thinking logs per agent
  public thinkingLogs: Map<string, TurnDecision[]> = new Map();

  constructor(useMockLLM = false) {
    this.useMockLLM = useMockLLM;
  }

  registerProvider(name: string, provider: LLMProvider): void {
    this.providers.set(name, provider);
  }

  getThinkingLog(agentId: string): TurnDecision[] {
    return this.thinkingLogs.get(agentId) || [];
  }

  async getActions(state: GameState, agent: Agent): Promise<Action[]> {
    if (this.useMockLLM) {
      const result = this.getMockActions(state, agent);
      this.recordThinking(agent, state.turn, result.reasoning, result.actions);
      return result.actions;
    }

    const provider = this.providers.get(agent.provider);
    if (!provider) {
      logger.warn(`No provider for ${agent.provider}, using mock`);
      const result = this.getMockActions(state, agent);
      this.recordThinking(agent, state.turn, result.reasoning, result.actions);
      return result.actions;
    }

    try {
      const systemPrompt = this.promptBuilder.buildSystemPrompt(agent);
      const userPrompt = this.promptBuilder.buildUserPrompt(state, agent);
      const response = await provider.generateResponse(systemPrompt, userPrompt);

      let reasoning = '';
      // Extract personality note and reasoning
      try {
        const raw = response.trim();
        const jsonStr = raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] || raw;
        const parsed = JSON.parse(jsonStr);
        if (parsed.personality_note && typeof parsed.personality_note === 'string') {
          agent.personality = parsed.personality_note;
        }
        if (parsed.reasoning && typeof parsed.reasoning === 'string') {
          reasoning = parsed.reasoning;
        }
      } catch { /* ignore */ }

      const actions = this.validator.parseAndValidate(response, agent.id);
      this.recordThinking(agent, state.turn, reasoning || 'LLM response parsed', actions);
      return actions;
    } catch (err: any) {
      logger.error(`LLM error for ${agent.name}: ${err.message}`);
      const result = this.getMockActions(state, agent);
      this.recordThinking(agent, state.turn, `Error: ${err.message}. Using mock AI.`, result.actions);
      return result.actions;
    }
  }

  private recordThinking(agent: Agent, turn: number, reasoning: string, actions: Action[]): void {
    if (!this.thinkingLogs.has(agent.id)) {
      this.thinkingLogs.set(agent.id, []);
    }
    const log = this.thinkingLogs.get(agent.id)!;
    log.push({
      turn,
      reasoning,
      actions: actions.map(a => a.type + (a.targetX != null ? ` → (${a.targetX},${a.targetY})` : '')),
      personalityNote: agent.personality,
      timestamp: Date.now(),
    });
    // Keep last 50 turns of thinking
    if (log.length > 50) log.shift();
  }

  /** Smart rule-based AI with emergent behavior based on attributes */
  private getMockActions(state: GameState, agent: Agent): ActionResult {
    const actions: Action[] = [];
    const thoughts: string[] = [];
    const ownedCells = state.map.flat().filter(c => c.owner === agent.id);
    const cellsWithUnits = ownedCells.filter(c => c.units > 0);

    const h = state.map.length;
    const w = state.map[0]?.length || 0;
    const ownedSet = new Set(ownedCells.map(c => `${c.x},${c.y}`));

    // Scan borders from ALL owned cells (not just those with units)
    // Then find the best source cell with units nearby
    const borderSet = new Map<string, { cell: typeof state.map[0][0]; borderCell: typeof state.map[0][0] }>();
    for (const cell of ownedCells) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = cell.x + dx, ny = cell.y + dy;
        const key = `${nx},${ny}`;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h && !ownedSet.has(key)) {
          const target = state.map[ny][nx];
          if (target.terrain !== 'water') {
            borderSet.set(key, { cell: target, borderCell: cell });
          }
        }
      }
    }

    // For each border target, find the nearest owned cell with units
    const adjacentCells: { cell: typeof state.map[0][0]; from: typeof state.map[0][0] }[] = [];
    for (const { cell: target, borderCell } of borderSet.values()) {
      // If the border cell itself has units, use it directly
      if (borderCell.units > 0) {
        adjacentCells.push({ cell: target, from: borderCell });
      } else {
        // Find any adjacent owned cell with units
        const source = cellsWithUnits.find(c => {
          const dist = Math.abs(c.x - target.x) + Math.abs(c.y - target.y);
          return dist <= 1 + Math.floor(agent.attributes.agility / 10);
        });
        if (source) {
          adjacentCells.push({ cell: target, from: source });
        }
      }
    }

    const neutralAdj = adjacentCells.filter(a => !a.cell.owner);
    const enemyAdj = adjacentCells.filter(a => a.cell.owner && a.cell.owner !== agent.id);

    // Emergent personality from attributes
    const isAggressive = agent.attributes.strength > 12;
    const isDefensive = agent.attributes.engineering > 12;
    const isDiplomatic = agent.attributes.charisma > 12;
    const isScholar = agent.attributes.wisdom > 12;
    const lowFood = agent.resources.food < agent.totalUnits * 5;
    const depletedCells = ownedCells.filter(c => c.richness < 20).length;
    const underPressure = depletedCells > ownedCells.length * 0.3;

    thoughts.push(`Territory: ${ownedCells.length} cells, ${cellsWithUnits.length} with units`);
    thoughts.push(`Borders: ${neutralAdj.length} neutral, ${enemyAdj.length} enemy adjacent`);
    if (lowFood) thoughts.push('WARNING: Low food supply, units at risk of starvation');
    if (underPressure) thoughts.push(`Resources depleting: ${depletedCells}/${ownedCells.length} cells below 20% richness`);
    if (isAggressive) thoughts.push('Military strength is high — seeking targets');
    if (isDiplomatic) thoughts.push('Charisma is strong — considering diplomacy');
    if (isDefensive) thoughts.push('Engineering focus — prioritizing fortifications');
    if (isScholar) thoughts.push('Wisdom-oriented — pursuing knowledge');

    // PRIORITY 1: EXPAND into neutral territory (always try first!)
    if (neutralAdj.length > 0) {
      // Try to expand into up to 2 neutral cells per turn
      const expandTargets = neutralAdj.filter(a => a.from.units >= 1);
      for (const target of expandTargets) {
        if (actions.length >= 2) break; // Leave 1 slot for other actions
        const moveCount = Math.max(1, Math.min(Math.floor(target.from.units / 2), 2));
        if (target.from.units >= moveCount) {
          thoughts.push(`Expanding to (${target.cell.x},${target.cell.y}) ${target.cell.terrain}`);
          actions.push({
            type: 'move', agentId: agent.id,
            sourceX: target.from.x, sourceY: target.from.y,
            targetX: target.cell.x, targetY: target.cell.y,
            unitCount: moveCount,
          });
          target.from.units -= moveCount; // Track units used this turn
        }
      }
    }

    // PRIORITY 2: ATTACK enemies (aggressive agents or when no neutral land left)
    if (actions.length < 3 && enemyAdj.length > 0) {
      if (isAggressive || neutralAdj.length === 0) {
        const target = enemyAdj.find(a => a.from.units >= 3);
        if (target) {
          const key = getDiplomacyKey(agent.id, target.cell.owner!);
          const rel = state.diplomacy[key];
          const atPeace = rel && (rel.type === 'peace' || rel.type === 'alliance');
          if (!atPeace) {
            thoughts.push(`Attacking ${target.cell.owner} at (${target.cell.x},${target.cell.y})`);
            actions.push({
              type: 'attack', agentId: agent.id,
              sourceX: target.from.x, sourceY: target.from.y,
              targetX: target.cell.x, targetY: target.cell.y,
              unitCount: target.from.units,
            });
          }
        }
      }
    }

    // PRIORITY 3: BUILD on owned cells
    if (actions.length < 3) {
      const buildable = ownedCells.filter(c => !c.building && c.terrain !== 'water');
      if (buildable.length > 0 && agent.resources.gold >= 30) {
        // Pick best cell for building
        let buildingType: string | null = null;
        let targetCell = buildable[0];

        if (lowFood) {
          const plains = buildable.find(c => c.terrain === 'plains');
          if (plains) { targetCell = plains; buildingType = 'farm'; }
        }
        if (!buildingType && isDefensive && !ownedCells.some(c => c.building?.type === 'wall')) {
          buildingType = 'wall';
        }
        if (!buildingType && isScholar && !ownedCells.some(c => c.building?.type === 'library') && agent.resources.gold >= 70) {
          buildingType = 'library';
        }
        if (!buildingType) {
          const forest = buildable.find(c => c.terrain === 'forest' || c.terrain === 'jungle');
          const mountain = buildable.find(c => c.terrain === 'mountains');
          const plains = buildable.find(c => c.terrain === 'plains');
          if (forest) { targetCell = forest; buildingType = 'lumberMill'; }
          else if (mountain) { targetCell = mountain; buildingType = 'mine'; }
          else if (plains) { targetCell = plains; buildingType = 'farm'; }
        }

        if (buildingType) {
          thoughts.push(`Building ${buildingType} at (${targetCell.x},${targetCell.y})`);
          actions.push({
            type: 'build', agentId: agent.id,
            targetX: targetCell.x, targetY: targetCell.y,
            buildingType: buildingType as any,
          });
        }
      }
    }

    // PRIORITY 4: TRAIN units (can always train at least 1 even without barracks)
    if (actions.length < 3 && agent.resources.gold >= 15 && agent.resources.food >= 10) {
      thoughts.push('Training new units');
      actions.push({ type: 'train', agentId: agent.id });
    }

    // PRIORITY 5: DIPLOMACY — coalition logic
    const aliveRivals = state.agents.filter(a => a.id !== agent.id && a.isAlive);
    const rivalScores = aliveRivals.map(a => ({
      agent: a,
      score: state.map.flat().filter(c => c.owner === a.id).length * 2 + a.totalUnits,
    })).sort((a, b) => b.score - a.score);

    const myScore = ownedCells.length * 2 + agent.totalUnits;
    const biggestThreat = rivalScores[0];

    if (actions.length < 3 && biggestThreat && biggestThreat.score > myScore * 1.3) {
      const potentialAlly = aliveRivals.find(a => {
        if (a.id === biggestThreat.agent.id) return false;
        const key = getDiplomacyKey(agent.id, a.id);
        const rel = state.diplomacy[key];
        return rel && rel.type === 'neutral';
      });
      if (potentialAlly) {
        thoughts.push(`${biggestThreat.agent.name} is dominant. Seeking alliance with ${potentialAlly.name}.`);
        actions.push({
          type: 'propose_alliance', agentId: agent.id,
          targetAgentId: potentialAlly.id,
        });
      }
    }

    if ((isDiplomatic || underPressure) && enemyAdj.length > 0 && actions.length < 3) {
      const nearbyEnemyId = enemyAdj[0].cell.owner!;
      const key = getDiplomacyKey(agent.id, nearbyEnemyId);
      const rel = state.diplomacy[key];
      if (rel && rel.type === 'neutral') {
        thoughts.push(`Proposing peace with ${nearbyEnemyId}`);
        actions.push({
          type: 'propose_peace', agentId: agent.id,
          targetAgentId: nearbyEnemyId,
        });
      }
    }

    // Aggressive betrayal
    if (isAggressive && actions.length < 3 && ownedCells.length > 15) {
      const weakNeighbor = enemyAdj.find(a => {
        const owner = state.agents.find(ag => ag.id === a.cell.owner);
        return owner && owner.totalUnits < agent.totalUnits * 0.5;
      });
      if (weakNeighbor?.cell.owner) {
        const key = getDiplomacyKey(agent.id, weakNeighbor.cell.owner);
        const rel = state.diplomacy[key];
        if (rel && (rel.type === 'peace' || rel.type === 'alliance') && agent.reputation > 30) {
          thoughts.push(`Betraying ${weakNeighbor.cell.owner} — they are weak`);
          actions.push({
            type: 'break_treaty', agentId: agent.id,
            targetAgentId: weakNeighbor.cell.owner,
          });
        }
      }
    }

    if (actions.length === 0) {
      actions.push({ type: 'gather', agentId: agent.id });
    }

    // Set emergent personality
    if (!agent.personality) {
      if (isAggressive) agent.personality = 'Emerging as a military power';
      else if (isDiplomatic) agent.personality = 'Building through diplomacy';
      else if (isDefensive) agent.personality = 'Fortifying and defending';
      else if (isScholar) agent.personality = 'Pursuing knowledge';
      else agent.personality = 'Finding its path...';
    }

    return { actions: actions.slice(0, 3), reasoning: thoughts.join('. ') };
  }
}
