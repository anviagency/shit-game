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

    const adjacentCells: { cell: typeof state.map[0][0]; from: typeof state.map[0][0] }[] = [];
    for (const cell of cellsWithUnits) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = cell.x + dx, ny = cell.y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const target = state.map[ny][nx];
          if (!ownedSet.has(`${nx},${ny}`) && target.terrain !== 'water') {
            adjacentCells.push({ cell: target, from: cell });
          }
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

    // DIPLOMACY — coalition logic
    // Find the strongest rival (most territory + units)
    const aliveRivals = state.agents.filter(a => a.id !== agent.id && a.isAlive);
    const rivalScores = aliveRivals.map(a => ({
      agent: a,
      score: state.map.flat().filter(c => c.owner === a.id).length * 2 + a.totalUnits,
    })).sort((a, b) => b.score - a.score);

    const myScore = ownedCells.length * 2 + agent.totalUnits;
    const biggestThreat = rivalScores[0];

    // Try to form coalition against biggest threat
    if (actions.length < 3 && biggestThreat && biggestThreat.score > myScore * 1.3) {
      // Find someone we're not allied with who also borders the threat
      const potentialAlly = aliveRivals.find(a => {
        if (a.id === biggestThreat.agent.id) return false;
        const key = getDiplomacyKey(agent.id, a.id);
        const rel = state.diplomacy[key];
        return rel && rel.type === 'neutral';
      });
      if (potentialAlly) {
        thoughts.push(`${biggestThreat.agent.name} is dominant (score ${biggestThreat.score} vs my ${myScore}). Seeking alliance with ${potentialAlly.name} to counter.`);
        actions.push({
          type: 'propose_alliance', agentId: agent.id,
          targetAgentId: potentialAlly.id,
        });
      }
    }

    // Peace with nearby enemies if diplomatic or under pressure
    if ((isDiplomatic || underPressure) && enemyAdj.length > 0 && actions.length < 3) {
      const nearbyEnemyId = enemyAdj[0].cell.owner!;
      const key = getDiplomacyKey(agent.id, nearbyEnemyId);
      const rel = state.diplomacy[key];
      if (rel && rel.type === 'neutral') {
        thoughts.push(`Proposing peace with ${nearbyEnemyId} to focus on survival.`);
        actions.push({
          type: 'propose_peace', agentId: agent.id,
          targetAgentId: nearbyEnemyId,
        });
      }
    }

    // Aggressive agents: break treaties to attack weak neighbors
    if (isAggressive && actions.length < 3 && ownedCells.length > 10) {
      const weakNeighbor = enemyAdj.find(a => {
        const owner = state.agents.find(ag => ag.id === a.cell.owner);
        return owner && owner.totalUnits < agent.totalUnits * 0.5;
      });
      if (weakNeighbor?.cell.owner) {
        const key = getDiplomacyKey(agent.id, weakNeighbor.cell.owner);
        const rel = state.diplomacy[key];
        if (rel && (rel.type === 'peace' || rel.type === 'alliance')) {
          thoughts.push(`Considering betrayal of ${weakNeighbor.cell.owner} — they are weak.`);
          // Only betray if reputation can handle it
          if (agent.reputation > 30) {
            actions.push({
              type: 'break_treaty', agentId: agent.id,
              targetAgentId: weakNeighbor.cell.owner,
            });
          }
        }
      }
    }

    // BUILD
    if (actions.length < 3) {
      const buildable = ownedCells.filter(c => !c.building && c.terrain !== 'water');
      if (buildable.length > 0 && agent.resources.gold >= 30) {
        const cell = buildable[0];
        let buildingType: string | null = null;

        if (lowFood && cell.terrain === 'plains') buildingType = 'farm';
        else if (isDefensive && !ownedCells.some(c => c.building?.type === 'wall')) buildingType = 'wall';
        else if (isScholar && !ownedCells.some(c => c.building?.type === 'library') && agent.resources.gold >= 70) buildingType = 'library';
        else if (cell.terrain === 'forest' || cell.terrain === 'jungle') buildingType = 'lumberMill';
        else if (cell.terrain === 'mountains') buildingType = 'mine';
        else if (cell.terrain === 'plains') buildingType = 'farm';

        if (buildingType) {
          actions.push({
            type: 'build', agentId: agent.id,
            targetX: cell.x, targetY: cell.y,
            buildingType: buildingType as any,
          });
        }
      }
    }

    // ATTACK / EXPAND
    if (actions.length < 3) {
      if (isAggressive && enemyAdj.length > 0) {
        const target = enemyAdj.find(a => a.from.units >= 4);
        if (target) {
          const key = getDiplomacyKey(agent.id, target.cell.owner!);
          const rel = state.diplomacy[key];
          const atPeace = rel && (rel.type === 'peace' || rel.type === 'alliance');
          if (!atPeace) {
            actions.push({
              type: 'attack', agentId: agent.id,
              sourceX: target.from.x, sourceY: target.from.y,
              targetX: target.cell.x, targetY: target.cell.y,
              unitCount: target.from.units,
            });
          }
        }
      }

      if (actions.length < 3 && neutralAdj.length > 0) {
        const target = neutralAdj.find(a => a.from.units >= 2);
        if (target) {
          actions.push({
            type: 'move', agentId: agent.id,
            sourceX: target.from.x, sourceY: target.from.y,
            targetX: target.cell.x, targetY: target.cell.y,
            unitCount: Math.max(1, Math.floor(target.from.units / 2)),
          });
        }
      }
    }

    // TRAIN
    if (actions.length < 3 && agent.resources.gold >= 15 && agent.resources.food >= 10) {
      actions.push({ type: 'train', agentId: agent.id });
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
