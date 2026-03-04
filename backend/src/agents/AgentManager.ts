import { GameState, Agent, Action, TurnDecision, BuildingType, DNAPatchProposal } from '../models/GameState.js';
import { LLMProvider } from './LLMProvider.js';
import { AgentPromptBuilder } from './AgentPromptBuilder.js';
import { ActionValidator } from './ActionValidator.js';
import { logger } from '../utils/logger.js';
import { BUILDING_COSTS, TRAIN_COST, RESEARCH_COST } from '../utils/constants.js';

function getDiplomacyKey(a: string, b: string): string {
  return [a, b].sort().join('-');
}

export interface ActionResult {
  actions: Action[];
  reasoning: string;
  dnaPatch?: DNAPatchProposal;
}

interface CellRef {
  x: number;
  y: number;
  terrain: string;
  owner: string | null;
  units: number;
  richness: number;
  building: { type: string } | null;
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
      // Extract personality note, reasoning, and DNA patch
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
        // Process DNA patch proposal
        if (parsed.dna_patch && typeof parsed.dna_patch === 'object') {
          this.applyDNAPatch(agent, parsed.dna_patch, state.turn);
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

  /** Validate and apply a DNA patch proposal from an LLM agent */
  private applyDNAPatch(agent: Agent, patch: any, turn: number): void {
    const validFields = ['identity', 'priorities', 'doctrine', 'style'] as const;
    if (!patch.field || !validFields.includes(patch.field)) return;
    if (!patch.newValue || typeof patch.newValue !== 'string') return;
    if (!patch.reason || typeof patch.reason !== 'string') return;

    // Reject patches that try to break core rules
    const forbidden = ['ignore rules', 'ignore dna', 'illegal', 'bypass', 'cheat'];
    const lowerValue = patch.newValue.toLowerCase();
    if (forbidden.some(f => lowerValue.includes(f))) {
      logger.warn(`${agent.name} tried forbidden DNA patch: ${patch.newValue}`);
      return;
    }

    const field = patch.field as typeof validFields[number];
    const oldValue = field === 'priorities'
      ? agent.dna.priorities.join(', ')
      : field === 'doctrine'
        ? agent.dna.doctrine.join('; ')
        : agent.dna[field];

    // Apply the patch
    if (field === 'priorities') {
      agent.dna.priorities = patch.newValue.split(',').map((s: string) => s.trim()).slice(0, 5);
    } else if (field === 'doctrine') {
      // Add new doctrine, keep max 5
      agent.dna.doctrine.push(patch.newValue);
      if (agent.dna.doctrine.length > 5) agent.dna.doctrine.shift();
    } else {
      agent.dna[field] = patch.newValue;
    }

    agent.dna.version++;

    // Log the change
    agent.dnaLog.push({
      turn,
      field,
      oldValue: String(oldValue),
      newValue: patch.newValue,
      reason: patch.reason,
    });

    // Keep dnaLog reasonable
    if (agent.dnaLog.length > 20) agent.dnaLog.shift();

    logger.info(`${agent.name} DNA evolved (v${agent.dna.version}): ${field} changed — ${patch.reason}`);
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

  /** Smart rule-based AI with emergent behavior based on attributes.
   *  All actions are pre-validated against game rules before being added. */
  private getMockActions(state: GameState, agent: Agent): ActionResult {
    const actions: Action[] = [];
    const thoughts: string[] = [];

    const h = state.map.length;
    const w = state.map[0]?.length || 0;

    // Build ownership data
    const ownedCells: CellRef[] = [];
    const cellsWithUnits: CellRef[] = [];
    for (const row of state.map) {
      for (const cell of row) {
        if (cell.owner === agent.id) {
          ownedCells.push(cell);
          if (cell.units > 0) cellsWithUnits.push(cell);
        }
      }
    }

    const ownedSet = new Set(ownedCells.map(c => `${c.x},${c.y}`));

    // Build legal adjacent targets: only cells that are DIRECTLY adjacent (distance=1) to a cell with units
    // This guarantees move/attack actions will pass the adjacency check
    const neutralAdj: { cell: CellRef; from: CellRef }[] = [];
    const enemyAdj: { cell: CellRef; from: CellRef }[] = [];

    for (const src of cellsWithUnits) {
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nx = src.x + dx, ny = src.y + dy;
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
        const target = state.map[ny][nx];
        if (target.terrain === 'water') continue;
        if (ownedSet.has(`${nx},${ny}`)) continue; // Already owned

        const entry = { cell: target, from: src };
        if (!target.owner) {
          // Avoid duplicate neutral targets
          if (!neutralAdj.some(a => a.cell.x === nx && a.cell.y === ny)) {
            neutralAdj.push(entry);
          }
        } else if (target.owner !== agent.id) {
          if (!enemyAdj.some(a => a.cell.x === nx && a.cell.y === ny)) {
            enemyAdj.push(entry);
          }
        }
      }
    }

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

    // Track used source cells to avoid double-spending units
    const usedUnits = new Map<string, number>(); // "x,y" → units already committed
    const availableUnits = (cell: CellRef): number => {
      const key = `${cell.x},${cell.y}`;
      return cell.units - (usedUnits.get(key) || 0);
    };
    const commitUnits = (cell: CellRef, count: number): void => {
      const key = `${cell.x},${cell.y}`;
      usedUnits.set(key, (usedUnits.get(key) || 0) + count);
    };

    // PRIORITY 1: EXPAND into neutral territory
    if (neutralAdj.length > 0) {
      // Sort by richness descending — expand to richest cells first
      const sorted = [...neutralAdj].sort((a, b) => b.cell.richness - a.cell.richness);
      for (const target of sorted) {
        if (actions.length >= 2) break;
        const avail = availableUnits(target.from);
        if (avail < 1) continue;
        const moveCount = Math.max(1, Math.min(Math.floor(avail / 2), 2));
        thoughts.push(`Expanding to (${target.cell.x},${target.cell.y}) ${target.cell.terrain}`);
        actions.push({
          type: 'move', agentId: agent.id,
          sourceX: target.from.x, sourceY: target.from.y,
          targetX: target.cell.x, targetY: target.cell.y,
          unitCount: moveCount,
        });
        commitUnits(target.from, moveCount);
      }
    }

    // PRIORITY 2: ATTACK enemies (aggressive agents or when no neutral land left)
    if (actions.length < 3 && enemyAdj.length > 0) {
      if (isAggressive || neutralAdj.length === 0) {
        // Find a target where we have enough available units
        const target = enemyAdj.find(a => availableUnits(a.from) >= 3);
        if (target) {
          const key = getDiplomacyKey(agent.id, target.cell.owner!);
          const rel = state.diplomacy[key];
          const atPeace = rel && (rel.type === 'peace' || rel.type === 'alliance');
          if (!atPeace) {
            const atkUnits = availableUnits(target.from);
            thoughts.push(`Attacking ${target.cell.owner} at (${target.cell.x},${target.cell.y}) with ${atkUnits} units`);
            actions.push({
              type: 'attack', agentId: agent.id,
              sourceX: target.from.x, sourceY: target.from.y,
              targetX: target.cell.x, targetY: target.cell.y,
              unitCount: atkUnits,
            });
            commitUnits(target.from, atkUnits);
          }
        }
      }
    }

    // PRIORITY 3: BUILD on owned cells — with full resource + terrain validation
    if (actions.length < 3) {
      const buildAction = this.pickLegalBuild(agent, ownedCells, lowFood, isDefensive, isScholar);
      if (buildAction) {
        thoughts.push(`Building ${buildAction.buildingType} at (${buildAction.targetX},${buildAction.targetY})`);
        actions.push(buildAction);
      }
    }

    // PRIORITY 4: TRAIN units (validate affordability)
    if (actions.length < 3 &&
        agent.resources.gold >= TRAIN_COST.gold &&
        agent.resources.food >= TRAIN_COST.food) {
      thoughts.push('Training new units');
      actions.push({ type: 'train', agentId: agent.id });
    }

    // PRIORITY 5: RESEARCH (if can afford)
    if (actions.length < 3 &&
        agent.resources.knowledge >= RESEARCH_COST.knowledge &&
        agent.resources.gold >= RESEARCH_COST.gold) {
      // Pick attribute based on personality
      let attr: 'strength' | 'wisdom' | 'engineering' | 'charisma' | 'agility' = 'strength';
      if (isScholar) attr = 'wisdom';
      else if (isDefensive) attr = 'engineering';
      else if (isDiplomatic) attr = 'charisma';
      else if (agent.attributes.agility < 10) attr = 'agility';
      thoughts.push(`Researching ${attr}`);
      actions.push({ type: 'research', agentId: agent.id, attribute: attr });
    }

    // PRIORITY 6: DIPLOMACY — coalition logic
    const aliveRivals = state.agents.filter(a => a.id !== agent.id && a.isAlive);

    // Pre-compute rival scores without using map.flat()
    const rivalTerritories = new Map<string, number>();
    for (const row of state.map) {
      for (const cell of row) {
        if (cell.owner && cell.owner !== agent.id) {
          rivalTerritories.set(cell.owner, (rivalTerritories.get(cell.owner) || 0) + 1);
        }
      }
    }

    const rivalScores = aliveRivals.map(a => ({
      agent: a,
      score: (rivalTerritories.get(a.id) || 0) * 2 + a.totalUnits,
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

    // PRIORITY 7: TRADE — exchange surplus resources for what we need
    if (actions.length < 3 && aliveRivals.length > 0) {
      const tradeAction = this.pickTrade(agent, aliveRivals, state);
      if (tradeAction) {
        thoughts.push(`Trading with ${tradeAction.targetAgentId}`);
        actions.push(tradeAction);
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

  /** Pick a legal build action with full resource + terrain validation */
  private pickLegalBuild(
    agent: Agent,
    ownedCells: CellRef[],
    lowFood: boolean,
    isDefensive: boolean,
    isScholar: boolean,
  ): Action | null {
    const buildable = ownedCells.filter(c => !c.building && c.terrain !== 'water');
    if (buildable.length === 0) return null;

    // Helper: can we afford this building type?
    const canAfford = (type: string): boolean => {
      const cost = BUILDING_COSTS[type];
      if (!cost) return false;
      return agent.resources.gold >= cost.gold &&
             agent.resources.wood >= cost.wood &&
             agent.resources.iron >= cost.iron;
    };

    // Helper: is terrain valid for this building?
    const terrainValid = (cell: CellRef, type: string): boolean => {
      if (type === 'mine') return cell.terrain === 'mountains';
      if (type === 'lumberMill') return cell.terrain === 'forest' || cell.terrain === 'jungle';
      return true; // Other buildings work on any non-water terrain
    };

    // Try building types in priority order based on personality/needs
    const candidates: { type: string; cell: CellRef }[] = [];

    // Priority: farm if low food
    if (lowFood) {
      const plains = buildable.find(c => c.terrain === 'plains');
      if (plains && canAfford('farm')) candidates.push({ type: 'farm', cell: plains });
    }

    // Defensive: wall
    if (isDefensive && !ownedCells.some(c => c.building?.type === 'wall')) {
      const wallCell = buildable[0];
      if (wallCell && canAfford('wall')) candidates.push({ type: 'wall', cell: wallCell });
    }

    // Scholar: library
    if (isScholar && !ownedCells.some(c => c.building?.type === 'library')) {
      const libCell = buildable[0];
      if (libCell && canAfford('library')) candidates.push({ type: 'library', cell: libCell });
    }

    // Terrain-specific buildings
    for (const cell of buildable) {
      if (cell.terrain === 'forest' || cell.terrain === 'jungle') {
        if (canAfford('lumberMill')) {
          candidates.push({ type: 'lumberMill', cell });
          break;
        }
      }
    }
    for (const cell of buildable) {
      if (cell.terrain === 'mountains') {
        if (canAfford('mine')) {
          candidates.push({ type: 'mine', cell });
          break;
        }
      }
    }
    for (const cell of buildable) {
      if (cell.terrain === 'plains') {
        if (canAfford('farm')) {
          candidates.push({ type: 'farm', cell });
          break;
        }
      }
    }

    // Barracks if no barracks yet and can afford
    if (!ownedCells.some(c => c.building?.type === 'barracks') && canAfford('barracks')) {
      const barCell = buildable[0];
      if (barCell) candidates.push({ type: 'barracks', cell: barCell });
    }

    // Pick first valid candidate
    for (const { type, cell } of candidates) {
      if (canAfford(type) && terrainValid(cell, type)) {
        return {
          type: 'build',
          agentId: agent.id,
          targetX: cell.x,
          targetY: cell.y,
          buildingType: type as BuildingType,
        };
      }
    }

    return null;
  }

  /** Pick a trade action: offer surplus resource for scarce one */
  private pickTrade(agent: Agent, rivals: Agent[], state: GameState): Action | null {
    const res = agent.resources;
    type ResKey = 'gold' | 'food' | 'wood' | 'iron' | 'knowledge';

    // Find what we have in surplus (>100) and what we're short on (<30)
    const surplus: { res: ResKey; amount: number }[] = [];
    const needs: { res: ResKey; amount: number }[] = [];

    const checks: [ResKey, number, number][] = [
      ['gold', 100, 30],
      ['food', 80, 20],
      ['wood', 60, 15],
      ['iron', 40, 10],
    ];

    for (const [r, surplusThresh, needThresh] of checks) {
      if (res[r] > surplusThresh) surplus.push({ res: r, amount: res[r] - surplusThresh });
      if (res[r] < needThresh) needs.push({ res: r, amount: needThresh - res[r] });
    }

    if (surplus.length === 0 || needs.length === 0) return null;

    // Find a trade partner — prefer allies/peace partners
    const getDiplomacyKey = (a: string, b: string) => [a, b].sort().join('-');
    const sortedPartners = [...rivals].sort((a, b) => {
      const ka = getDiplomacyKey(agent.id, a.id);
      const kb = getDiplomacyKey(agent.id, b.id);
      const relA = state.diplomacy[ka]?.type || 'neutral';
      const relB = state.diplomacy[kb]?.type || 'neutral';
      const score = (r: string) => r === 'alliance' ? 2 : r === 'peace' ? 1 : 0;
      return score(relB) - score(relA);
    });

    const give = surplus[0];
    const want = needs[0];
    const giveAmount = Math.min(give.amount, 40); // Cap per trade
    const wantAmount = Math.min(want.amount, 30);

    // Find partner who has what we need
    for (const partner of sortedPartners) {
      if (partner.resources[want.res] >= wantAmount) {
        return {
          type: 'trade',
          agentId: agent.id,
          targetAgentId: partner.id,
          giveResource: give.res,
          giveAmount,
          wantResource: want.res,
          wantAmount,
        };
      }
    }

    return null;
  }
}
